import { readFileSync, writeFileSync } from 'fs';
import { basename } from 'path';
import { ArrayBufferFile } from '../src/files/binary-read';
import { readMapSummaries, readMapFromSummary, serializeWad } from '../src/files/wad';
import { Vec2 } from '../src/vector2';

function usage(): never {
    console.error(`usage: exportMap <input-file> <output-filename>`);
    process.exit(1);
}

async function getMapFromFile(filename: string) {
    const data = readFileSync(filename);
    const stream = new ArrayBufferFile(data.buffer);
    const summaries = await readMapSummaries(stream);
    if (summaries.length < 1) {
        throw new Error(`No maps in file: ${filename}`);
    }
    return readMapFromSummary(summaries[0]);
}

interface FaceInfo {
    pointIndexes: number[]
    textureIndex: number
    sAxisIndex: number
    tAxisIndex: number
    portalDest: number
}

function newFace({pointIndexes, textureIndex, sAxisIndex, tAxisIndex, portalDest}: FaceInfo): void {
    console.log('    Face:new(');
    console.log('      {');
    for (const pointIdx of pointIndexes) {
        console.log(`        points[${pointIdx}],`);
    }
    console.log('      },');
    console.log(`      ${textureIndex},`);
    console.log(`      ${sAxisIndex},`);
    console.log(`      ${tAxisIndex},`);
    console.log(`      ${portalDest}`);
    console.log('    ),');
}

export async function map2pico(args: string[]): Promise<void> {
    if (args.length !== 2) {
        usage();
    }

    const map = await getMapFromFile(args[0]);

    console.log('points = {');
    for (const point of map.points) {
        console.log(`  {${point[0] / 1024}, ${32 - point[1] / 1024}, 0},`);
        console.log(`  {${point[0] / 1024}, ${32 - point[1] / 1024}, 1},`);
    }
    console.log('}');

    console.log('sectors = {');
    
    for (const polygon of map.polygons) {
        const pointIndexes = polygon.endpoints;
        
        console.log('  Sector:new{');

        // floor
        newFace({
            pointIndexes: [...pointIndexes].reverse().map(idx => idx * 2 + 1),
            textureIndex: 2,
            sAxisIndex: 1,
            tAxisIndex: 3,
            portalDest: -1
        });
        
        // ceiling
        newFace({
            pointIndexes: pointIndexes.map(idx => idx * 2 + 2),
            textureIndex: 3,
            sAxisIndex: 1,
            tAxisIndex: 3,
            portalDest: -1
        });

        for (let i = 0; i < pointIndexes.length; ++i) {
            const nextI = (i + 1) % pointIndexes.length;
            const corners = [
                pointIndexes[i] * 2 + 1,
                pointIndexes[nextI] * 2 + 1,
                pointIndexes[nextI] * 2 + 2,
                pointIndexes[i] * 2 + 2
            ];
            newFace({
                pointIndexes: corners,
                textureIndex: 1,
                sAxisIndex: 1,
                tAxisIndex: 2,
                portalDest: -1
            });
        }
        
        console.log('  },');
    }

    console.log('}');
    
    //writeFileSync(args[1], new Uint8Array(data));
}
