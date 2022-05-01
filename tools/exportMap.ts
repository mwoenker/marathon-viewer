import { readFileSync, writeFileSync } from 'fs';
import { basename } from 'path';
import { ArrayBufferFile } from '../src/files/binary-read';
import { readMapSummaries, readMapFromSummary, serializeWad } from '../src/files/wad';

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

export async function exportMap(args: string[]): Promise<void> {
    if (args.length !== 2) {
        usage();
    }

    const map = await getMapFromFile(args[0]);
    const data = serializeWad([map.removePrecalculatedInfo()], basename(args[1]));
    writeFileSync(args[1], new Uint8Array(data));
}
