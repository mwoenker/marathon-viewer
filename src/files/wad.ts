import { RandomAccess, Reader, readRange, getDataFork } from './binary-read';
import { MapGeometry } from './map';
import { Collections } from './shapes';
import { readPoint } from './map/utils';
import { Side } from './map/side';
import { Polygon } from './map/polygon';
import { Light } from './map/light';
import { MapObject } from './map/object';
import { Line } from './map/line';
import { ItemPlacement } from './map/item-placement';
import { Endpoint } from './map/endpoint';
import { Media } from './map/media';
import { AmbientSound } from './map/ambient-sound';
import { RandomSound } from './map/random-sound';
import { Note } from './map/note';
import { Platform } from './map/platform';
import { MapInfo } from './map/map-info';
import { Vec2 } from '../vector2'

export interface WadDirectoryEntry {
    offset: number,
    length: number,
    index: number,
    missionFlags: number,
    environmentFlags: number,
    entryPointFlags: number,
    levelName: string,
}

export interface WadHeader {
    wadVersion: number,
    dataVersion: number,
    filename: string,
    crc: number,
    dirOffset: number,
    nEntries: number,
    appDataBytes: number,
    chunkSize: number,
    entrySize: number,
    parentCrc: number,
    directory: WadDirectoryEntry[]
}

export interface MapSummary {
    index: number;
    data: RandomAccess;
    directoryEntry: WadDirectoryEntry;
    header: WadHeader;
}

interface ChunkHeader {
    name: string,
    nextOffset: number,
    size: number
}

function readDirectoryEntry(bytes: ArrayBuffer, entrySize: number, wadVersion: number): WadDirectoryEntry {
    const r = new Reader(bytes);
    const offset = r.uint32();
    const length = r.uint32();

    if (wadVersion < 2) {
        throw new Error("Wad version <2 not supported")
    }

    const index = r.uint16();
    const missionFlags = r.int16();
    const environmentFlags = r.int16();
    const entryPointFlags = r.int32();
    const levelName = r.cString(66);

    return { offset, length, index, missionFlags, environmentFlags, entryPointFlags, levelName };
}

async function readWadHeader(file: RandomAccess): Promise<WadHeader> {
    const r = new Reader(await readRange(file, 0, 128));
    const wadVersion = r.uint16();
    const dataVersion = r.uint16();
    const filename = r.cString(64);
    const crc = r.uint32();
    const dirOffset = r.uint32();
    const nEntries = r.uint16();
    const appDataBytes = r.uint16();
    const chunkSize = r.uint16() || 16;
    const entrySize = r.uint16() || 10;
    const parentCrc = r.uint32();

    const fullEntrySize = wadVersion < 1 ? 8 : entrySize + appDataBytes;
    const dirData = await readRange(
        file, dirOffset, dirOffset + (nEntries * fullEntrySize));
    const directory = [];
    for (let i = 0; i < nEntries; ++i) {
        const start = (i * fullEntrySize);
        const end = start + fullEntrySize;
        const entryData = dirData.slice(start, end);
        directory.push(readDirectoryEntry(entryData, entrySize, wadVersion));
    }

    return {
        wadVersion,
        dataVersion,
        filename,
        crc,
        dirOffset,
        nEntries,
        appDataBytes,
        chunkSize,
        entrySize,
        parentCrc,
        directory
    };
}

type Parser = (reader: Reader) => any;

class ChunkParser {
    parsers: Map<string, Parser>
    constructor() {
        this.parsers = new Map();
    }
    define(type: string, parser: Parser) {
        this.parsers.set(type, parser);
    }
    defineArray(type: string, parseOne: Parser) {
        this.define(type, r => {
            const items = [];
            while (!r.eof()) {
                items.push(parseOne(r));
            }
            return items;
        });
    }
    parse(header: ChunkHeader, data: ArrayBuffer) {
        const parser = this.parsers.get(header.name);
        const reader = new Reader(data);
        if (!parser) {
            return null;
        }
        return parser(reader);
    }
}

const chunkParser = new ChunkParser();

chunkParser.defineArray('EPNT', (r) => Endpoint.read(r));
chunkParser.defineArray('PNTS', readPoint);
chunkParser.defineArray('LINS', (r) => Line.read(r))
chunkParser.defineArray('SIDS', (r) => Side.read(r));
chunkParser.defineArray('POLY', (r) => Polygon.read(r));
chunkParser.defineArray('LITE', (r) => Light.read(r));
chunkParser.defineArray('OBJS', (r) => MapObject.read(r))
chunkParser.defineArray('plac', r => ItemPlacement.read(r));
chunkParser.defineArray('medi', r => Media.read(r));
chunkParser.defineArray('ambi', r => AmbientSound.read(r));
chunkParser.defineArray('bonk', r => RandomSound.read(r))
chunkParser.defineArray('NOTE', r => Note.read(r));
chunkParser.defineArray('PLAT', r => Platform.read(r));
chunkParser.define('Minf', (r) => MapInfo.read(r));

async function readEntryChunks(
    file: RandomAccess,
    wadHeader: WadHeader,
    index: number,
    whitelist?: string[]
): Promise<Map<string, any>> {
    const entry = wadHeader.directory.find(entry => entry.index === index);
    if (!entry) {
        throw new Error(`entry ${index} not found`);
    }

    const chunks = new Map();
    const data = await readRange(
        file, entry.offset, entry.offset + entry.length);

    let chunkStart = 0;
    while (chunkStart < data.byteLength) {
        const headerSize = 0 === wadHeader.wadVersion ? 12 : wadHeader.chunkSize;
        const r = new Reader(
            data.slice(chunkStart, chunkStart + headerSize));
        const chunkHeader = {
            name: r.fixString(4),
            nextOffset: r.uint32(),
            size: r.uint32(),
        };

        const dataStart = chunkStart + headerSize;
        const chunkData = data.slice(dataStart, dataStart + chunkHeader.size);

        if (!whitelist || whitelist.includes(chunkHeader.name)) {
            const chunk = chunkParser.parse(chunkHeader, chunkData);
            if (chunk) {
                chunks.set(chunkHeader.name, chunk);
            } else {
                chunks.set(chunkHeader.name, chunkData);
            }
        }

        if (chunkHeader.nextOffset <= chunkStart) {
            break;
        }

        chunkStart = chunkHeader.nextOffset;
    }

    return chunks;
}

async function readMap(file: RandomAccess, wadHeader: WadHeader, index: number): Promise<MapGeometry> {
    const chunks = await readEntryChunks(file, wadHeader, index);
    let points: Vec2[] = [];
    if (chunks.has('PNTS')) {
        points = (chunks.get('PNTS') as Vec2[]);
    } else if (chunks.has('EPNT')) {
        points = (chunks.get('EPNT') as Endpoint[]).map((endpoint: Endpoint) => {
            return endpoint.position
        });
    } else {
        throw Error('No EPNT or PNTS chunk');
    }

    if (!chunks.get('LINS')) {
        throw Error('No LINS chunk');
    }

    if (!chunks.get('POLY')) {
        throw Error('No POLY chunk');
    }

    return new MapGeometry({
        index: index,
        header: wadHeader,
        info: chunks.get('Minf') as MapInfo,
        points: points,
        lights: chunks.get('LITE') as Light[],
        lines: chunks.get('LINS') as Line[],
        sides: chunks.get('SIDS') as Side[],
        polygons: chunks.get('POLY') as Polygon[],
        media: (chunks.get('medi') || []) as Media[],
        objects: (chunks.get('OBJS') || []) as MapObject[],
        itemPlacement: (chunks.get('plac') || []) as ItemPlacement[],
        ambientSounds: (chunks.get('ambi') || []) as AmbientSound[],
        randomSounds: (chunks.get('bonk') || []) as RandomSound[],
        platforms: (chunks.get('PLAT') || []) as Platform[],
        // terminals: (chunks.get('term') || []) as Terminal[],
        notes: (chunks.get('NOTE') || []) as Note[],
    });
}

async function readMapFromSummary(summary: MapSummary): Promise<MapGeometry> {
    return readMap(summary.data, summary.header, summary.index);
}

async function readAllMaps(file: RandomAccess): Promise<MapGeometry[]> {
    const wadData = await getDataFork(file);
    const wadHeader = await readWadHeader(wadData);
    const mapPromises = wadHeader.directory
        .map(entry => readMap(wadData, wadHeader, entry.index));
    const unsortedMaps = await Promise.all(mapPromises);
    const maps = unsortedMaps.sort((a, b) => a.index - b.index);
    return maps;
}

async function readMapSummaries(file: RandomAccess): Promise<MapSummary[]> {
    const wadData = await getDataFork(file);
    const wadHeader = await readWadHeader(wadData);
    const summaries = wadHeader.directory.map(
        (entry, i) => ({
            index: wadHeader.directory[i].index,
            data: wadData,
            directoryEntry: wadHeader.directory[i],
            header: wadHeader,
        }));
    return summaries;
}

enum sideType {
    full = 0,
    high,
    low,
    composite,
    split,
}

enum TransferMode {
    normal = 0,
    fadeOutToBlack, /* reduce ambient light until black, then tint-fade out */
    invisibility,
    subtleInvisibility,
    pulsate, /* only valid for polygons */
    wobble, /* only valid for polygons */
    fastWobble, /* only valid for polygons */
    static,
    static50Percent,
    landscape,
    smear, /* repeat pixel(0,0) of texture everywhere */
    fadeOutStatic,
    pulsatingStatic,
    foldIn, /* appear */
    foldOut, /* disappear */
    horizontalSlide,
    fastHorizontalSlide,
    verticalSlide,
    fastVerticalSlide,
    wander,
    fastWander,
    bigLandscape, // unused I think? I think originally this distinguished between m2, m1 style landscapes
}

enum mediaTypes {
    water = 0,
    lava,
    goo,
    sewage,
    jjaro,
}

interface mediaDefinitionsType {
    [idx: number]: { collection: number, shape: number }
}

export const mediaDefinitions: mediaDefinitionsType = {
    [mediaTypes.water]: {
        collection: Collections.wallsWater,
        shape: 19,
    },
    [mediaTypes.lava]: {
        collection: Collections.wallsLava,
        shape: 12,
    },
    [mediaTypes.goo]: {
        collection: Collections.wallsPfhor,
        shape: 5,
    },
    [mediaTypes.sewage]: {
        collection: Collections.wallsSewage,
        shape: 13,
    },
    [mediaTypes.jjaro]: {
        collection: Collections.wallsJjaro,
        shape: 13,
    },
};

export {
    readAllMaps,
    readMapSummaries,
    readMapFromSummary,
    mediaTypes,
    sideType,
    TransferMode,
};
