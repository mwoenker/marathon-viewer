import { worldUnitSize } from './constants';
import { clamp, lerp } from './utils';

// all components integers between 0 and 255
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

function color(red: number, green: number, blue: number, alpha = 255): ColorComponents {
    return { red, green, blue, alpha };
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

export const highlightColor = packColor(128, 255, 255);
export const highlightOpacity = 0.1;

function lerpColor(a: number, b: number, t: number): number {
    const interpolated = lerpColorComponents(unpackColor(a), unpackColor(b), t);
    return packColor(
        interpolated.red,
        interpolated.green,
        interpolated.blue,
        interpolated.alpha
    );
}

function lerpColorComponents(a: ColorComponents, b: ColorComponents, t: number): ColorComponents {
    return {
        red: Math.floor(lerp(t, a.red, b.red)),
        green: Math.floor(lerp(t, a.green, b.green)),
        blue: Math.floor(lerp(t, a.blue, b.blue)),
        alpha: Math.floor(lerp(t, a.alpha, b.alpha)),
    };
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

export const polygonColor = color(0xf8, 0xf8, 0xf8);

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

export function getCssColor({ red, green, blue, alpha }: ColorComponents): string {
    return `rgba(${red}, ${green}, ${blue}, ${alpha / 255})`;
}

const blackComponents = color(0, 0, 0);
const whiteComponents = color(255, 255, 255);
const redComponents = color(255, 0, 0);
const greenComponents = color(0, 255, 0);
const blueComponents = color(0, 0, 255);
const orangeComponents = color(255, 128, 0);
const magentaComponents = color(255, 0, 255);
const cyanComponents = color(0, 255, 255);
const yellowComponents = color(255, 255, 0);

const darkRamps = [
    redComponents,
    blueComponents,
    greenComponents,
    orangeComponents,
    magentaComponents,
    cyanComponents,
    yellowComponents
];

const lightRamps = darkRamps.map(color => lerpColorComponents(color, whiteComponents, 0.5));

const ramps = [...darkRamps, ...lightRamps];

const minIntensity = 0.25;
const colorsPerRamp = 6;

// Used for color coding polygon heights
export function colorCodeForIndex(index: number): ColorComponents {
    const rampIndex = Math.floor(index / colorsPerRamp) % ramps.length;
    const rampShade = index % colorsPerRamp;
    const lightestColor = ramps[rampIndex];
    const darkestColor = lerpColorComponents(blackComponents, lightestColor, minIntensity);
    return lerpColorComponents(
        lightestColor,
        darkestColor,
        rampShade / (colorsPerRamp - 1)
    );
}
