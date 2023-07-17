import { worldUnitSize } from './constants';
import { clamp, lerp } from './utils';

export interface ColorComponents {
    red: number;
    green: number;
    blue: number;
    alpha: number;
}

const color32 = new Uint32Array(1);
const color8 = new Uint8Array(color32.buffer);

export function packColor(r: number, g: number, b: number, a = 255): number {
    color8[0] = clamp(r, 0, 255);
    color8[1] = clamp(g, 0, 255);
    color8[2] = clamp(b, 0, 255);
    color8[3] = clamp(a, 0, 255);
    return color32[0];
}

export function unpackColor(val: number): ColorComponents {
    color32[0] = val;
    return {
        red: color8[0],
        green: color8[1],
        blue: color8[2],
        alpha: color8[3],
    };
}

const nShadingLevels = 256;

export type SourceColor = {
    r: number;
    g: number;
    b: number;
}

export type SourceColorTable = SourceColor[]
export type ColorTable = number[]
export interface ShadingTables {
    normal: ColorTable[]
    highlighted: ColorTable[]
}

const highlightColor = packColor(128, 255, 255);
const highlightOpacity = 0.5;

function lerpColor(a: number, b: number, t: number): number {
    const aElements = unpackColor(a);
    const bElements = unpackColor(b);
    return packColor(
        Math.floor(lerp(t, aElements.red, bElements.red)),
        Math.floor(lerp(t, aElements.green, bElements.green)),
        Math.floor(lerp(t, aElements.blue, bElements.blue)),
        Math.floor(lerp(t, aElements.alpha, bElements.alpha)),
    );
}

function makeHighlightedTable(table: ColorTable) {
    return table.map(color => {
        return lerpColor(color, highlightColor, highlightOpacity);
    });
}

export function makeShadingTables(colorTable: SourceColorTable): ShadingTables {
    const shadingLevels = new Array(nShadingLevels);
    for (let i = 0; i < nShadingLevels; ++i) {
        shadingLevels[i] = colorTable.map(({ r, g, b }, colorIndex) => {
            const brightness = i / (nShadingLevels - 1);
            const alpha = colorIndex === 0 ? 0 : 1;
            return packColor(
                r * alpha * brightness / 256,
                g * alpha * brightness / 256,
                b * alpha * brightness / 256,
                alpha * 255
            );
        });
    }
    return {
        normal: shadingLevels,
        highlighted: shadingLevels.map(table => makeHighlightedTable(table)),
    };
}

export const black = packColor(0, 0, 0);
export const magenta = packColor(255, 0, 255);
export const yellow = packColor(255, 255, 0);

export function shadingTableForDistance(
    tables: ColorTable[], dist: number, surfaceBrightness = 1
): ColorTable {
    const minerLightDist = 8 * worldUnitSize;
    const minerLightFrac = clamp(dist, 0, minerLightDist) / minerLightDist;
    const minerLightBrightness = 0.3 * (1 - minerLightFrac);
    const brightness = clamp(minerLightBrightness + surfaceBrightness, 0, 1);
    return tables[Math.floor(brightness * (nShadingLevels - 1))];
}

export function fullBrightShadingTable(tables: ColorTable[]): ColorTable {
    return tables[tables.length - 1];
}
