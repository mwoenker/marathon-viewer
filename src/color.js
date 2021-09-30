const color32 = new Uint32Array(1);
const color8 = new Uint8Array(color32.buffer);

export function packColor(r, g, b, a = 255) {
    color8[0] = parseInt(Math.max(0, Math.min(r, 255)));
    color8[1] = parseInt(Math.max(0, Math.min(g, 255)));
    color8[2] = parseInt(Math.max(0, Math.min(b, 255)));
    color8[3] = 255;
    return color32[0];
}

export function unpackColor(val) {
    color32[0] = val;
    return [color8[0], color8[1], color8[2], color8[3]];
}

const nShadingLevels = 64;

export function makeShadingTables(colorTable) {
    const shadingLevels = new Array(nShadingLevels);
    for (let i = 0; i < nShadingLevels; ++i) {
        shadingLevels[i] = colorTable.map(({r, g, b}) => {
            const brightness = i / (nShadingLevels - 1); 
            return packColor(
                r * brightness / 256,
                g * brightness / 256,
                b * brightness / 256,
            );
        });
    }
    return shadingLevels;
}

export const black = packColor(0, 0, 0);
export const magenta = packColor(255, 0, 255);
export const yellow = packColor(255, 255, 0);

export function shadingTableForDistance(tables, dist, surfaceBrightness = 1) {
    const minerLightDist = 8;
    const minerLightFrac = Math.max(0, Math.min(minerLightDist, dist)) / minerLightDist;
    const minerLightBrightness = 0.3 * (1 - minerLightFrac);
    const brightness = Math.min(1, minerLightBrightness + surfaceBrightness);
    // const minerLight = Math.max(0, Math.min(nShadingLevels - 1, nShadingLevels - (dist * 8) - 1));
    // const shadingLevel = Math.max(0, Math.min(nShadingLevels - 1, nShadingLevels - (dist * 8) - 1));
    return tables[parseInt(brightness * (nShadingLevels - 1))];
}
