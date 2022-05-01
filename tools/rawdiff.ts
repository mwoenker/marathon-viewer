import { readFileSync } from 'fs';
import { ArrayBufferFile } from '../src/files/binary-read';
import { readRawChunks, RawChunk } from '../src/files/serializers';
import { readMapSummaries } from '../src/files/wad';
import { createHash } from 'crypto';

function usage() {
    console.log('usage: rawdiff <left> <right>');
    process.exit(1);
}

async function getMapFromFile(filename: string) {
    const data = readFileSync(filename);
    const stream = new ArrayBufferFile(data.buffer);
    const summaries = await readMapSummaries(stream);
    return readRawChunks(stream, summaries[0].header, 0);
}

function chunkKeys(chunks: RawChunk[]) {
    return chunks.map(c => c.name);
}

function getChunk(chunks: RawChunk[], name: string) {
    return chunks.find(c => c.name === name);
}

function arrayBufferEqual(left: ArrayBuffer, right: ArrayBuffer): boolean {
    if (left.byteLength !== right.byteLength) {
        return false;
    } else {
        const leftBytes = new Uint8Array(left);
        const rightBytes = new Uint8Array(right);
        for (let i = 0; i < leftBytes.length; ++i) {
            if (leftBytes[i] !== rightBytes[i]) {
                console.log({ i, left: leftBytes[i], right: rightBytes[i] });
                return false;
            }
        }
        return true;
    }
}

export async function rawdiff(args: string[]): Promise<void> {
    if (args.length !== 2) {
        usage();
    }

    const left = await getMapFromFile(args[0]);
    const right = await getMapFromFile(args[1]);

    console.log(left.map(s => s.name));
    console.log(right.map(s => s.name));

    const keys = new Set([...chunkKeys(left), ...chunkKeys(right)]);

    for (const key of keys) {
        const leftChunk = getChunk(left, key);
        const rightChunk = getChunk(right, key);
        if (!leftChunk) {
            console.log(key, 'left missing');
        } else if (!rightChunk) {
            console.log(key, 'right missing');
        } else if (leftChunk.data.byteLength !== rightChunk.data.byteLength) {
            console.log(
                key,
                `size mismatch: ${leftChunk.data.byteLength} vs ${rightChunk.data.byteLength}`);
        } else if (!arrayBufferEqual(leftChunk.data, rightChunk.data)) {
            console.log(key, 'data mismatch');
        } else {
            console.log(key, 'equal');
        }
    }

    // for (const { name, data } of left) {
    //     const hash = createHash('sha256');
    //     hash.update(new Uint8Array(data));
    //     console.log(name, hash.digest('hex'));
    // }

    // console.log();

    // for (const { name, data } of right) {
    //     const hash = createHash('sha256');
    //     hash.update(new Uint8Array(data));
    //     console.log(name, hash.digest('hex'));
    // }
}
