import { readFileSync } from 'fs';
import { ArrayBufferFile } from '../src/files/binary-read';
import { readMapSummaries, readMapFromSummary } from '../src/files/wad';
import { LineFlag } from '../src/files/map/line';

function usage(): never {
    console.error(`usage: mapdiff <first-file> <second-file>`);
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

function isObject(obj: unknown): obj is Record<PropertyKey, unknown> {
    return Boolean(obj && typeof obj === 'object');
}

function isArray(obj: unknown): obj is unknown[] {
    return Array.isArray(obj);
}

type PathElement = string | number
type Path = PathElement[]

function pathToStr(path: Path) {
    return path.join('.');
}

function diffValues(left: unknown, right: unknown, path: Path = []) {
    if (isArray(left) && isArray(right)) {
        if (left.length !== right.length) {
            console.error('Mismatched array lenghts', pathToStr(path));
        } else {
            for (let i = 0; i < left.length; ++i) {
                diffValues(left[i], right[i], [...path, i]);
            }
        }
    } else if (isObject(left) && isObject(right)) {
        const leftKeys = Object.keys(left);
        const rightKeys = Object.keys(right);
        const allKeys = new Set([...leftKeys, ...rightKeys]);
        if (allKeys.size !== leftKeys.length || allKeys.size !== rightKeys.length) {
            console.error(`Keys mismatch at ${pathToStr(path)}: ${leftKeys} !== ${rightKeys}`);
        } else {
            for (const key of allKeys) {
                diffValues(left[key], right[key], [...path, key]);
            }
        }
    } else if (left !== right) {
        console.error(
            `Mismatch value ${pathToStr(path)}: ${left} !== ${right}`);
    }
}

export async function mapdiff(args: string[]): Promise<void> {
    if (args.length !== 2) {
        usage();
    }

    const firstMap = await getMapFromFile(args[0]);
    const secondMap = await getMapFromFile(args[1]);

    diffValues(firstMap, secondMap);
}
