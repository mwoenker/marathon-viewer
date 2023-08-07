import { errorName } from './error-name';
import { floatBytes, lightNumCoords, positionNumCoords, Shader, texNumCoords, tintColorNumCoords } from './shaders';
import { ShapeTextures } from './shape-textures';
import { RenderVertex } from '../rasterize';
import { TransferMode } from '../files/wad';
import { highlightColor, highlightOpacity, unpackColor } from '../color';

const vertexSize = positionNumCoords + texNumCoords + lightNumCoords + tintColorNumCoords;
const triangleSize = vertexSize * 3;
const vertexBufferMaxSize = triangleSize * 4096;
const vertexBufferBytes = floatBytes * vertexBufferMaxSize;

const staticShapeDescriptor = -1;

interface DrawCall {
    first: number,
    count: number,
    shapeDescriptor: number;
}

const highlightColorComponents = unpackColor(highlightColor);
highlightColorComponents.alpha = highlightOpacity * 255;

export class GeometryBuffer {
    elementsWritten: number;
    vertexBuffer: Float32Array;
    gl: WebGL2RenderingContext;
    shader: Shader;
    shapeTextures: ShapeTextures;
    buffer: WebGLBuffer;
    drawCalls: DrawCall[];
    nDrawCalls: number;

    constructor(
        gl: WebGL2RenderingContext,
        shapeTextures: ShapeTextures,
        shader: Shader
    ) {
        this.gl = gl;
        this.shader = shader;
        this.vertexBuffer = new Float32Array(vertexBufferMaxSize);
        this.elementsWritten = 0;
        this.shapeTextures = shapeTextures;
        const buffer = gl.createBuffer();
        if (!buffer) {
            throw new Error(`gl.createBuffer failed: ${errorName(gl)}`);
        }
        this.buffer = buffer;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertexBufferBytes, gl.STREAM_DRAW);

        this.buffer = buffer;
        this.nDrawCalls = 0;
        this.drawCalls = [];
    }

    flush(): void {
        this.nDrawCalls += this.drawCalls.length;
        const gl = this.gl;

        if (this.elementsWritten > 0) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);

            const shaderInfo = this.shader;
            gl.useProgram(shaderInfo.program);

            const type = gl.FLOAT;
            const normalize = false;

            gl.vertexAttribPointer(
                shaderInfo.vertexPosition,
                positionNumCoords,
                type,
                normalize,
                shaderInfo.stride,
                shaderInfo.vertexOffset);
            gl.vertexAttribPointer(
                shaderInfo.texCoord,
                texNumCoords,
                type,
                normalize,
                shaderInfo.stride,
                shaderInfo.texCoordOffset);
            gl.vertexAttribPointer(
                shaderInfo.light,
                lightNumCoords,
                type,
                normalize,
                shaderInfo.stride,
                shaderInfo.lightOffset);
            gl.vertexAttribPointer(
                shaderInfo.tintColor,
                tintColorNumCoords,
                type,
                normalize,
                shaderInfo.stride,
                shaderInfo.tintColorOffset
            );

            gl.enableVertexAttribArray(shaderInfo.vertexPosition);
            gl.enableVertexAttribArray(shaderInfo.texCoord);
            gl.enableVertexAttribArray(shaderInfo.light);
            gl.enableVertexAttribArray(shaderInfo.tintColor);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertexBuffer, 0, this.elementsWritten);
            gl.activeTexture(gl.TEXTURE0);

            gl.uniform1i(shaderInfo.textureSampler, 0);
            const now = Date.now() / 512;
            const entropy = (now - Math.floor(now));
            gl.uniform1f(this.shader.time, entropy);

            for (const { first, count, shapeDescriptor } of this.drawCalls) {
                if (shapeDescriptor === staticShapeDescriptor) {
                    gl.uniform1i(this.shader.renderType, 2);
                } else {
                    gl.uniform1i(this.shader.renderType, 1);
                    gl.bindTexture(gl.TEXTURE_2D, this.shapeTextures.get(shapeDescriptor));
                }
                gl.drawArrays(gl.TRIANGLES, first, count);
            }
        }
        this.elementsWritten = 0;
        this.drawCalls = [];
    }

    addVertex(p: RenderVertex, light: number, highlighted: boolean): void {
        const tintComponents = highlighted
            ? highlightColorComponents
            : { red: 0, green: 0, blue: 0, alpha: 0 };

        const start = this.elementsWritten;

        this.vertexBuffer[this.elementsWritten++] = p.position[0];
        this.vertexBuffer[this.elementsWritten++] = p.position[1];
        this.vertexBuffer[this.elementsWritten++] = p.position[2];
        this.vertexBuffer[this.elementsWritten++] = p.texCoord[0];
        this.vertexBuffer[this.elementsWritten++] = p.texCoord[1];
        this.vertexBuffer[this.elementsWritten++] = light;
        this.vertexBuffer[this.elementsWritten++] = tintComponents.red / 255;
        this.vertexBuffer[this.elementsWritten++] = tintComponents.green / 255;
        this.vertexBuffer[this.elementsWritten++] = tintComponents.blue / 255;
        this.vertexBuffer[this.elementsWritten++] = tintComponents.alpha / 255;

        if (this.elementsWritten - start !== vertexSize) {
            throw new Error(`vertex is the wrong size! ${this.elementsWritten - start} instead of ${vertexSize}`);
        }
    }

    addTriangle(p1: RenderVertex, p2: RenderVertex, p3: RenderVertex, light: number, isTinted: boolean): void {
        this.addVertex(p1, light, isTinted);
        this.addVertex(p2, light, isTinted);
        this.addVertex(p3, light, isTinted);
    }

    addPolygon(shapeDescriptor: number, transferMode: TransferMode, vertices: RenderVertex[], light: number, isTinted: boolean): void {
        if (transferMode === TransferMode.static) {
            shapeDescriptor = staticShapeDescriptor;
        }

        const nDrawVertices = 3 * (vertices.length - 2);
        if (this.elementsWritten + (vertexSize * nDrawVertices) >= this.vertexBuffer.length) {
            this.flush();
        }
        const startElement = this.elementsWritten;
        for (let i = 1; i < vertices.length - 1; ++i) {
            this.addTriangle(vertices[0], vertices[i], vertices[i + 1], light, isTinted);
        }

        if (this.drawCalls.length > 0 &&
            this.drawCalls[this.drawCalls.length - 1].shapeDescriptor === shapeDescriptor) {
            const lastShape = this.drawCalls[this.drawCalls.length - 1];
            lastShape.count += nDrawVertices;
        } else {
            this.drawCalls.push({
                first: startElement / vertexSize,
                count: nDrawVertices,
                shapeDescriptor
            });
        }
    }

    dispose(): void {
        this.gl.deleteBuffer(this.buffer);
    }
}
