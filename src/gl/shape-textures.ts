import { RGBABitmap } from './rgba-bitmap';
import { Shapes } from '../shapes-loader';
import { shapeToRGBA } from './rgba-bitmap';
import { fullBrightShadingTable } from '../color';
import { errorName } from './error-name';

function isPowerOf2(n: number) {
    return (n & (n - 1)) === 0;
}

function createTexture(bitmap: RGBABitmap, gl: WebGL2RenderingContext) {
    const texture = gl.createTexture();
    if (!texture) {
        throw new Error(`createTexture() failed; ${errorName(gl)}`);
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, bitmap.width, bitmap.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(bitmap.pixels.buffer));

    gl.generateMipmap(gl.TEXTURE_2D);

    return texture;
}

export class ShapeTextures {
    textures: Map<number, WebGLTexture | null>;
    shapeLoader: Shapes;
    gl: WebGL2RenderingContext;

    constructor(gl: WebGL2RenderingContext, shapeLoader: Shapes) {
        this.gl = gl;
        this.shapeLoader = shapeLoader;
        this.textures = new Map();
    }

    get(descriptor: number): WebGLTexture | null {
        if (!this.textures.has(descriptor)) {
            const shape = this.shapeLoader.getBitmap(descriptor);
            if (shape) {
                const shadingTables = this.shapeLoader.getShadingTables(descriptor);
                if (shadingTables) {
                    console.log('creating gl texture', descriptor);
                    const colorTable = fullBrightShadingTable(shadingTables);
                    const rgbaBitmap = shapeToRGBA(shape, colorTable);
                    let texture = null;
                    try {
                        texture = createTexture(rgbaBitmap, this.gl);
                    } catch (e) {
                        this.textures.set(descriptor, null);
                    }
                    this.textures.set(descriptor, texture);
                }
            }
        }

        return this.textures.get(descriptor) || null;
    }

    dispose(): void {
        for (const texture of this.textures.values()) {
            this.gl.deleteTexture(texture);
        }
        this.textures.clear();
    }
}
