import { RandomAccess, Reader, readRange } from './binary-read';
import { Vec2 } from '../vector2';
const nCollections = 32;
const collectionHeaderSize = 32;

// See shape_descriptors.h in aleph one
export enum Collections {
    interface,
    weaponsInHand,
    juggernaut,
    tick,
    rocket,
    hunter,
    player,
    items,
    trooper,
    fighter,
    defender,
    yeti,
    civilian,
    civilianFusion,
    enforcer,
    hummer,
    compiler,
    wallsWater,
    wallsLava,
    wallsSewage,
    wallsJjaro,
    wallsPfhor,
    sceneryWater,
    sceneryLava,
    scenerySewage,
    sceneryJjaro,
    sceneryPfhor,
    landscapeDay,
    landscapeNight,
    landscapeMoon,
    landscapeSpace,
    cyborg,
}

export const CollectionNames: Record<Collections, string> = {
    [Collections.interface]: 'Interface',
    [Collections.weaponsInHand]: 'Weapons in Hand',
    [Collections.juggernaut]: 'Juggernaut',
    [Collections.tick]: 'Tick',
    [Collections.rocket]: 'Rocket',
    [Collections.hunter]: 'Hunter',
    [Collections.player]: 'Player',
    [Collections.items]: 'Items',
    [Collections.trooper]: 'Trooper',
    [Collections.fighter]: 'Fighter',
    [Collections.defender]: 'Defender',
    [Collections.yeti]: 'Yeti',
    [Collections.civilian]: 'Civilian',
    [Collections.civilianFusion]: 'Civilian Fusion',
    [Collections.enforcer]: 'Enforcer',
    [Collections.hummer]: 'Hummer',
    [Collections.compiler]: 'Compiler',
    [Collections.wallsWater]: 'Walls (Water)',
    [Collections.wallsLava]: 'Walls (Lava)',
    [Collections.wallsSewage]: 'Walls (Sewage)',
    [Collections.wallsJjaro]: 'Walls (Jjaro)',
    [Collections.wallsPfhor]: 'Walls (Pfhor)',
    [Collections.sceneryWater]: 'Scenery (Water)',
    [Collections.sceneryLava]: 'Scenery (Lava)',
    [Collections.scenerySewage]: 'Scenery (Sewage)',
    [Collections.sceneryJjaro]: 'Scenery (Jjaro)',
    [Collections.sceneryPfhor]: 'Scenery (Pfhor)',
    [Collections.landscapeDay]: 'Landscape Day',
    [Collections.landscapeNight]: 'Landscape Night',
    [Collections.landscapeMoon]: 'Landscape Moon',
    [Collections.landscapeSpace]: 'Landscape Space',
    [Collections.cyborg]: 'Cyborg',
};

export function makeShapeDescriptor(collection: number, clut: number, shape: number): number {
    return ((clut & 0x03) << 13) |
        ((collection & 0x01f) << 8) |
        (shape & 0x0ff);
}

export interface ParsedDescriptor {
    bitmapIndex: number;
    collectionIndex: number;
    clutIndex: number;
}

export function parseShapeDescriptor(descriptor: number): ParsedDescriptor {
    return {
        bitmapIndex: descriptor & 0xff,
        collectionIndex: (descriptor >> 8) & 0x1f,
        clutIndex: (descriptor >> 13) & 0x07,
    };
}

export interface ShapesColor {
    flags: number;
    value: number;
    r: number;
    g: number;
    b: number;
}

export interface ShapesHeader {
    status: number;
    flags: number;
    offset8: number;
    length8: number;
    offset16: number;
    length16: number;
}

export interface CollectionHeader {
    status: number;
    flags: number;
    offset8: number;
    length8: number;
    offset16: number;
    length16: number;
}

export interface CollectionHeaders {
    header: CollectionHeader,
    version: number,
    type: number,
    flags: number,
    colorsPerTable: number,
    colorTableCount: number,
    colorTablesOffset: number,
    sequenceCount: number,
    sequenceTableOffset: number,
    frameCount: number,
    frameTableOffset: number,
    bitmapCount: number,
    bitmapTableOffset: number,
    scaleFactor: number,
    collectionSize: number,
}

export interface Sequence {
    type: number;
    flags: number;
    name: string;
    numberOfViews: number;
    framesPerView: number;
    ticksPerFrame: number;
    keyFrame: number;
    transferMode: number;
    transferModePeriod: number;
    firstFrameSound: number;
    keyFrameSound: number;
    lastFrameSound: number;
    scaleFactor: number;
    loopFrame: number;
}

export interface Bitmap {
    width: number;
    height: number;
    bytesPerRow: number;
    flags: number;
    bitDepth: number;
    offset: number
    columnOrder: boolean;
    data: Uint8Array;
}

export interface Frame {
    flags: number;
    minimumLighIntensity: number;
    bitmapIndex: number;
    origin: Vec2;
    key: Vec2;
    worldLeft: number;
    worldRight: number;
    worldTop: number;
    worldBottom: number;
    world: Vec2;
}

export interface Collection extends CollectionHeaders {
    sequences: Sequence[],
    frames: Frame[],
    bitmaps: Bitmap[]
    colorTables: ShapesColor[][]
}

export const COLUMN_ORDER_BIT = 0x8000;
export const SELF_LUMINESCENT_BIT = 0x80;

function readColorTable(bytes: ArrayBuffer, colorsPerTable: number): ShapesColor[] {
    const r = new Reader(bytes);

    const table = [];
    for (let i = 0; i < colorsPerTable; ++i) {
        table.push({
            flags: r.uint8(),
            value: r.uint8(),
            r: r.uint16(),
            g: r.uint16(),
            b: r.uint16(),
        });
    }
    return table;
}

function readColorTables(bytes: ArrayBuffer, collection: CollectionHeaders) {
    const tables = [];
    for (let i = 0; i < collection.colorTableCount; ++i) {
        const colorSize = 8;
        const tableSize = collection.colorsPerTable * colorSize;
        const tableBase = collection.colorTablesOffset + i * tableSize;
        const tableBytes = bytes.slice(tableBase, tableBase + tableSize);
        tables.push(readColorTable(tableBytes, collection.colorsPerTable));
    }

    return tables;
}

function readBitmap(bytes: ArrayBuffer, offset: number): Bitmap {
    const r = new Reader(bytes.slice(offset));

    const width = r.int16();
    const height = r.int16();
    const bytesPerRow = r.int16();
    const flags = r.uint16();
    const bitDepth = r.int16();

    const columnOrder = 0 != (flags & COLUMN_ORDER_BIT);
    const nSlices = columnOrder ? width : height;
    const sliceSize = columnOrder ? height : width;

    console.assert(width <= 2048);
    console.assert(height <= 2048);
    console.assert(-1 === bytesPerRow ||
        sliceSize === bytesPerRow);
    console.assert(8 === bitDepth);

    r.skip(20);
    r.skip(4 * nSlices);

    let data: Uint8Array;
    if (bytesPerRow < 0) {
        data = new Uint8Array(width * height);
        for (let i = 0; i < nSlices; ++i) {
            const begin = r.int16();
            const end = r.int16();
            console.assert(begin >= 0 && begin < 2048);
            console.assert(end >= 0 && end < 2048);
            for (let j = begin; j < end; ++j) {
                data[sliceSize * i + j] = r.uint8();
            }
        }
    } else {
        data = r.raw(width * height);
    }

    return {
        width,
        height,
        bytesPerRow,
        flags,
        bitDepth,
        offset,
        columnOrder,
        data,
    };
}

function readBitmaps(bytes: ArrayBuffer, collection: CollectionHeaders): Bitmap[] {
    const r = new Reader(bytes.slice(
        collection.bitmapTableOffset,
        collection.bitmapTableOffset + 4 * collection.bitmapCount));

    const bitmaps = [];
    for (let i = 0; i < collection.bitmapCount; ++i) {
        const offset = r.int32();
        bitmaps.push(readBitmap(bytes, offset));
    }
    return bitmaps;
}

function readFrame(bytes: ArrayBuffer, offset: number): Frame {
    const r = new Reader(bytes.slice(offset, offset + 36));

    return {
        flags: r.int16(),
        minimumLighIntensity: r.int32(),
        bitmapIndex: r.int16(),
        origin: [r.int16(), r.int16()],
        key: [r.int16(), r.int16()],
        worldLeft: r.int16(),
        worldRight: r.int16(),
        worldTop: r.int16(),
        worldBottom: r.int16(),
        world: [r.int16(), r.int16()],
    };
}

function readFrames(bytes: ArrayBuffer, collection: CollectionHeaders): Frame[] {
    const r = new Reader(bytes.slice(
        collection.frameTableOffset,
        collection.frameTableOffset + 4 * collection.frameCount));

    const frames = [];
    for (let i = 0; i < collection.frameCount; ++i) {
        const offset = r.int32();
        frames.push(readFrame(bytes, offset));
    }

    return frames;
}

function readSequence(bytes: ArrayBuffer, offset: number): Sequence {
    const r = new Reader(bytes.slice(offset, offset + 88));

    const seq = {
        type: r.int16(),
        flags: r.uint16(),
        name: r.pascalString(34),
        numberOfViews: r.int16(),
        framesPerView: r.int16(),
        ticksPerFrame: r.int16(),
        keyFrame: r.int16(),
        transferMode: r.int16(),
        transferModePeriod: r.int16(),
        firstFrameSound: r.int16(),
        keyFrameSound: r.int16(),
        lastFrameSound: r.int16(),
        scaleFactor: r.int16(),
        loopFrame: r.int16(),
    };

    return seq;
}

// Sequence, aka high level shapes in marathon terminology
function readSequences(bytes: ArrayBuffer, collection: CollectionHeaders): Sequence[] {
    const r = new Reader(bytes.slice(
        collection.sequenceTableOffset,
        collection.sequenceTableOffset + 4 * collection.sequenceCount));

    const sequences = [];
    for (let i = 0; i < collection.sequenceCount; ++i) {
        const offset = r.int32();
        sequences.push(readSequence(bytes, offset));
    }

    return sequences;
}

export async function readCollection(file: RandomAccess, header: ShapesHeader): Promise<Collection> {
    let offset, length;
    if (header.offset16 <= 0 || header.length16 <= 0) {
        offset = header.offset8;
        length = header.length8;
    } else {
        offset = header.offset16;
        length = header.offset16;
    }
    if (offset <= 0 || length <= 0) {
        throw new Error('empty collection');
    }

    const collectionBytes = await readRange(file, offset, offset + length);
    const r = new Reader(collectionBytes);

    const collectionHeaders = {
        header: header,
        version: r.int16(),
        type: r.int16(),
        flags: r.uint16(),
        colorsPerTable: r.int16(),
        colorTableCount: r.int16(),
        colorTablesOffset: r.int32(),
        sequenceCount: r.int16(),
        sequenceTableOffset: r.int32(),
        frameCount: r.int16(),
        frameTableOffset: r.int32(),
        bitmapCount: r.int16(),
        bitmapTableOffset: r.int32(),
        scaleFactor: r.int16(),
        collectionSize: r.int32(),
    };

    const collection = {
        ...collectionHeaders,
        sequences: readSequences(collectionBytes, collectionHeaders),
        frames: readFrames(collectionBytes, collectionHeaders),
        bitmaps: readBitmaps(collectionBytes, collectionHeaders),
        colorTables: readColorTables(collectionBytes, collectionHeaders),
    };

    return collection;
}

export async function readShapesHeaders(file: RandomAccess): Promise<ShapesHeader[]> {
    const r = new Reader(await readRange(
        file,
        0,
        nCollections * collectionHeaderSize));
    const headers = [];
    for (let i = 0; i < nCollections; ++i) {
        const header = {
            status: r.int16(),
            flags: r.uint16(),
            offset8: r.int32(),
            length8: r.int32(),
            offset16: r.int32(),
            length16: r.int32(),
        };
        r.skip(12);
        headers.push(header);
    }
    return headers;
}

export interface AllShapes {
    [idx: number]: Collection
}

export async function readShapes(file: RandomAccess): Promise<AllShapes> {
    const headers = await readShapesHeaders(file);
    const collectionIndexes = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
        20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31];
    const promises = collectionIndexes.map(
        async i => [i, await readCollection(file, headers[i])]);
    return Object.fromEntries(await Promise.all(promises));
}
