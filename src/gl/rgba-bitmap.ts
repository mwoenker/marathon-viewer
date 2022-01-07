import { ColorTable } from '../color';
import { Bitmap } from '../files/shapes';

export class RGBABitmap {
    pixels: Uint32Array;
    width: number;
    height: number;

    constructor(pixels: Uint32Array, width: number, height: number) {
        if (pixels.length !== width * height) {
            throw new Error('invalid size for pixels');
        }
        this.pixels = pixels;
        this.width = width;
        this.height = height;
    }
}

export function shapeToRGBA(shapeBitmap: Bitmap, colorTable: ColorTable): RGBABitmap {
    if (shapeBitmap.bytesPerRow < 0) {
        throw new Error('compressed bitmaps not supported');
    }
    const pixels = new Uint32Array(shapeBitmap.width * shapeBitmap.height);
    if (shapeBitmap.columnOrder) {
        for (let col = 0; col < shapeBitmap.width; ++col) {
            for (let row = 0; row < shapeBitmap.height; ++row) {
                const outOffset = shapeBitmap.width * row + col;
                const inOffset = shapeBitmap.bytesPerRow * col + row;
                const colorIndex = shapeBitmap.data[inOffset];
                pixels[outOffset] = colorTable[colorIndex];
            }
        }
    } else {
        for (let row = 0; row < shapeBitmap.height; ++row) {
            for (let col = 0; col < shapeBitmap.width; ++col) {
                const outOffset = shapeBitmap.width * row + col;
                const inOffset = shapeBitmap.bytesPerRow * row + col;
                const colorIndex = shapeBitmap.data[inOffset];
                pixels[outOffset] = colorTable[colorIndex];
            }
        }
    }
    return new RGBABitmap(pixels, shapeBitmap.width, shapeBitmap.height);
}
