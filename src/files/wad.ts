import { RandomAccess, Reader, readRange, getDataFork } from './binary-read';
import { MapGeometry } from './map';
import { Collections } from './shapes';
import { readMap, serializeMap } from './serializers';
import { ArrayBufferWriter, Writer } from './binary-write';

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

const wadHeaderSize = 128;
const wadHeaderDataSize = 88;

function readDirectoryEntry(bytes: ArrayBuffer, fullEntrySize: number, wadVersion: number): WadDirectoryEntry {
    const r = new Reader(bytes);
    const offset = r.uint32();
    const length = r.uint32();

    if (wadVersion < 2) {
        throw new Error("Wad version <2 not supported");
    }

    const index = r.uint16();

    let missionFlags = 0;
    let environmentFlags = 0;
    let entryPointFlags = 0;
    let levelName = 'Untitled';

    if (fullEntrySize >= 84) {
        missionFlags = r.int16();
        environmentFlags = r.int16();
        entryPointFlags = r.int32();
        levelName = r.cString(66);
    }

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
        directory.push(readDirectoryEntry(entryData, fullEntrySize, wadVersion));
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

async function readMapFromSummary(summary: MapSummary): Promise<MapGeometry> {
    return new MapGeometry(await readMap(summary.data, summary.header, summary.index));
}

async function readAllMaps(file: RandomAccess): Promise<MapGeometry[]> {
    const wadData = await getDataFork(file);
    const wadHeader = await readWadHeader(wadData);
    const mapPromises = wadHeader.directory
        .map(entry => readMap(wadData, wadHeader, entry.index).then(map => new MapGeometry(map)));
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


export function serializeWad(entries: MapGeometry[], filename: string): ArrayBuffer {
    const writer = new ArrayBufferWriter();

    const version = 4;
    const dataVersion = 1;
    const appDataBytes = 74;
    const chunkSize = 16;
    const entrySize = 10;
    const parentCrc = 0;

    const serializedMaps = entries.map(serializeMap);
    const mapsLength = serializedMaps.reduce((size, buf) => size + buf.byteLength, 0);
    const dirOffset = wadHeaderSize + mapsLength;

    writer.uint16(version); // version
    writer.uint16(dataVersion); // data version
    writer.cString(64, filename);
    writer.uint32(0); // crc; must be corrected later
    writer.uint32(dirOffset);
    writer.uint16(entries.length);
    writer.uint16(appDataBytes);
    writer.uint16(chunkSize);
    writer.uint16(entrySize);
    writer.uint32(parentCrc);
    writer.zeros(wadHeaderSize - wadHeaderDataSize);

    if (writer.position() !== wadHeaderSize) {
        throw new Error(
            `Wrote incorrect wad header size ${writer.position()}, should be ${wadHeaderSize}`);
    }

    serializedMaps.forEach(map => writer.bytes(map));

    if (writer.position() !== dirOffset) {
        throw new Error(
            `Wrote incorrect directory offset ${dirOffset}, should be ${writer.position()}`);
    }

    let mapDataOffset = wadHeaderSize;
    entries.forEach((map, i) => {
        const start = writer.position();
        writer.uint32(mapDataOffset);
        writer.uint32(serializedMaps[i].byteLength);
        writer.uint16(i);
        writer.uint16(map.info.missionFlags);
        writer.uint16(map.info.environmentFlags);
        writer.uint32(map.info.entryFlags);
        writer.cString(66, map.info.name);
        const end = writer.position();
        if (end - start !== entrySize + appDataBytes) {
            throw new Error(
                `Wrote incorrect sized dir entry ${end - start}, should be ${entrySize + appDataBytes}`);
        }
        mapDataOffset += serializedMaps[i].byteLength;
    });

    return writer.getBuffer();
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
