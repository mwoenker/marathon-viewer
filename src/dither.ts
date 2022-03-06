import { unpackColor, packColor } from './color';

export function ditherRandom(src: Uint32Array, dst: Uint32Array, width: number, height: number): void {
    const white = packColor(255, 255, 255);
    const black = packColor(0, 0, 0);
    for (let y = 0; y < height; ++y) {
        for (let x = 0; x < width; ++x) {
            const color = src[y * width + x];
            const { red, green, blue } = unpackColor(color);
            const brightness = (red + green + blue) / 3 / 255;
            const dithered = Math.random() > brightness ? black : white;
            dst[y * width + x] = dithered;
        }
    }
}

export function dither(src: Uint32Array, dst: Uint32Array, width: number, height: number): void {
    const white = packColor(255, 255, 255);
    const black = packColor(0, 0, 0);
    let thisLineError = new Array<number>(width + 2).fill(0);
    let nextLineError = new Array<number>(width + 2).fill(0);
    for (let y = 0; y < height; ++y) {
        for (let x = 0; x < width; ++x) {
            const idx = width * y + x;
            const color = src[idx];
            const { red, green, blue } = unpackColor(color);
            const brightness = (red + green + blue) / 3 / 255 + thisLineError[x + 1];
            const quantized = 0.5 > brightness ? black : white;
            dst[idx] = quantized;
            const error = 0.5 > brightness ? brightness : brightness - 1;
            thisLineError[x + 2] += error * 7 / 16;
            nextLineError[x] += error * 3 / 16;
            nextLineError[x + 1] += error * 5 / 16;
            nextLineError[x + 2] += error * 1 / 16;
        }
        const tmp = nextLineError;
        nextLineError = thisLineError;
        thisLineError = tmp;
        nextLineError.fill(0);
    }
}
