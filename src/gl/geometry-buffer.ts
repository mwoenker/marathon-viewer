import { errorName } from './error-name';
import { Shader } from './shaders';
import { ShapeTextures } from './shape-textures';
import { RenderVertex } from '../rasterize';
import { TransferMode } from '../files/wad';

const positionNumCoords = 3;
const texNumCoords = 2;
const lightNumCoords = 1;
const vertexSize = positionNumCoords + texNumCoords + lightNumCoords;
const triangleSize = vertexSize * 3;
const vertexBufferMaxSize = triangleSize * 4096;
const vertexBufferBytes = 4 * vertexBufferMaxSize;

const staticShapeDescriptor = -1;

interface DrawCall {
    first: number,
    count: number,
    shapeDescriptor: number;
}

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
            gl.enableVertexAttribArray(shaderInfo.vertexPosition);
            gl.enableVertexAttribArray(shaderInfo.texCoord);
            gl.enableVertexAttribArray(shaderInfo.light);
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

    addVertex(p: RenderVertex, light: number): void {
        this.vertexBuffer[this.elementsWritten++] = p.position[0];
        this.vertexBuffer[this.elementsWritten++] = p.position[1];
        this.vertexBuffer[this.elementsWritten++] = p.position[2];
        this.vertexBuffer[this.elementsWritten++] = p.texCoord[0];
        this.vertexBuffer[this.elementsWritten++] = p.texCoord[1];
        this.vertexBuffer[this.elementsWritten++] = light;
    }

    addTriangle(p1: RenderVertex, p2: RenderVertex, p3: RenderVertex, light: number): void {
        this.addVertex(p1, light);
        this.addVertex(p2, light);
        this.addVertex(p3, light);
    }

    addPolygon(shapeDescriptor: number, transferMode: TransferMode, vertices: RenderVertex[], light: number): void {
        if (transferMode === TransferMode.static) {
            shapeDescriptor = staticShapeDescriptor;
        }

        const nDrawVertices = 3 * (vertices.length - 2);
        if (this.elementsWritten + (vertexSize * nDrawVertices) >= this.vertexBuffer.length) {
            this.flush();
        }
        const startElement = this.elementsWritten;
        for (let i = 1; i < vertices.length - 1; ++i) {
            this.addTriangle(vertices[0], vertices[i], vertices[i + 1], light);
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
