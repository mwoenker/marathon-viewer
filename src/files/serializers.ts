import { RandomAccess, Reader, readRange } from './binary-read';
import { ArrayBufferWriter, Writer } from './binary-write';

import { readPoint, writePoint } from './map/utils';
import { Side } from './map/side';
import { Polygon } from './map/polygon';
import { Light } from './map/light';
import { MapObject } from './map/object';
import { Line, LineFlag } from './map/line';
import { ItemPlacement } from './map/item-placement';
import { Endpoint } from './map/endpoint';
import { Media } from './map/media';
import { AmbientSound } from './map/ambient-sound';
import { RandomSound } from './map/random-sound';
import { Note } from './map/note';
import { Platform } from './map/platform';
import { DynamicPlatform } from './map/dynamicPlatform';
import { MapInfo } from './map/map-info';
import { Vec2 } from '../vector2';
import { WadHeader } from './wad';
import { MapGeometry } from './map';
import { assertDefined, defined } from '../utils';

interface SerializerInstance {
    write(writer: Writer): void
}

interface SerializerClass<InstanceType extends SerializerInstance> {
    read(reader: Reader): InstanceType
}

function readPoints(reader: Reader, chunkSize: number) {
    const points: Vec2[] = [];
    const startPos = reader.pos;
    while (reader.pos - startPos < chunkSize) {
        points.push(readPoint(reader));
    }
    return points;
}

function serializePoints(points: Vec2[]) {
    const writer = new ArrayBufferWriter();
    for (const point of points) {
        writePoint(writer, point);
    }
    return writer.getBuffer();
}

enum ChunkType {
    'Minf',
    'PNTS',
    'EPNT',
    'LINS',
    'SIDS',
    'POLY',
    'LITE',
    'medi',
    'OBJS',
    'plac',
    'ambi',
    'bonk',
    'PLAT',
    'plat',
    'NOTE'
}

type ChunkTypeName = keyof typeof ChunkType

interface Chunks {
    info: MapInfo,
    points: Vec2[],
    endpoints: Endpoint[],
    lines: Line[],
    sides: Side[],
    polygons: Polygon[],
    lights: Light[],
    media: Media[],
    objects: MapObject[],
    itemPlacement: ItemPlacement[],
    ambientSounds: AmbientSound[],
    randomSounds: RandomSound[],
    platforms: Platform[],
    dynamicPlatforms: DynamicPlatform[],
    notes: Note[],
}

function validChunkType(chunkType: string): chunkType is ChunkTypeName {
    return chunkType in ChunkType;
}

function assertNever(thing: never): never {
    throw new Error(`Value shouldn't exist: ${thing}`);
}

function readArray<T extends SerializerInstance>(
    serializerClass: SerializerClass<T>,
    reader: Reader,
    chunkSize: number
): T[] {
    const objs: T[] = [];
    const startPos = reader.pos;
    while (reader.pos - startPos < chunkSize) {
        objs.push(serializerClass.read(reader));
    }
    return objs;
}

function readChunk(chunkType: ChunkTypeName, data: ArrayBuffer, chunks: Partial<Chunks>): void {
    const chunkReader = new Reader(data);

    switch (chunkType) {
        case 'Minf':
            chunks.info = MapInfo.read(chunkReader);
            break;
        case 'PNTS':
            chunks.points = readPoints(chunkReader, data.byteLength);
            break;
        case 'EPNT':
            chunks.endpoints = readArray(Endpoint, chunkReader, data.byteLength);
            break;
        case 'LINS':
            chunks.lines = readArray(Line, chunkReader, data.byteLength);
            break;
        case 'SIDS':
            chunks.sides = readArray(Side, chunkReader, data.byteLength);
            break;
        case 'POLY':
            chunks.polygons = readArray(Polygon, chunkReader, data.byteLength);
            break;
        case 'LITE':
            chunks.lights = readArray(Light, chunkReader, data.byteLength);
            break;
        case 'medi':
            chunks.media = readArray(Media, chunkReader, data.byteLength);
            break;
        case 'OBJS':
            chunks.objects = readArray(MapObject, chunkReader, data.byteLength);
            break;
        case 'plac':
            chunks.itemPlacement = readArray(ItemPlacement, chunkReader, data.byteLength);
            break;
        case 'ambi':
            chunks.ambientSounds = readArray(AmbientSound, chunkReader, data.byteLength);
            break;
        case 'bonk':
            chunks.randomSounds = readArray(RandomSound, chunkReader, data.byteLength);
            break;
        case 'PLAT':
            chunks.dynamicPlatforms = readArray(DynamicPlatform, chunkReader, data.byteLength);
            break;
        case 'plat':
            chunks.platforms = readArray(Platform, chunkReader, data.byteLength);
            break;
        case 'NOTE':
            chunks.notes = readArray(Note, chunkReader, data.byteLength);
            break;
        default:
            assertNever(chunkType);
    }
}

export async function readEntryChunks(
    file: RandomAccess,
    wadHeader: WadHeader,
    index: number
): Promise<Partial<Chunks>> {
    const entry = wadHeader.directory.find(entry => entry.index === index);
    if (!entry) {
        throw new Error(`entry ${index} not found`);
    }

    const chunks: Partial<Chunks> = {};
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
        const chunkType = chunkHeader.name;

        if (validChunkType(chunkType)) {
            readChunk(chunkType, chunkData, chunks);
        } else {
            console.log('Skipping chunk type', chunkType);
        }


        if (chunkHeader.nextOffset <= chunkStart) {
            break;
        }

        chunkStart = chunkHeader.nextOffset;
    }

    return chunks;
}

export interface RawChunk {
    name: string
    nextOffset: number
    size: number
    data: ArrayBuffer
}

export async function readRawChunks(
    file: RandomAccess,
    wadHeader: WadHeader,
    index: number
): Promise<RawChunk[]> {
    const entry = wadHeader.directory.find(entry => entry.index === index);
    if (!entry) {
        throw new Error(`entry ${index} not found`);
    }

    const data = await readRange(
        file, entry.offset, entry.offset + entry.length);

    const chunks: RawChunk[] = [];
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

        chunks.push({ ...chunkHeader, data: chunkData });

        if (chunkHeader.nextOffset <= chunkStart) {
            break;
        }

        chunkStart = chunkHeader.nextOffset;
    }

    return chunks;
}

interface Map extends Omit<Chunks, 'dynamicPlatforms' | 'endpoints'> {
    header: WadHeader,
    index: number,
}

export async function readMap(
    file: RandomAccess,
    wadHeader: WadHeader,
    index: number
): Promise<Map> {
    const chunks = await readEntryChunks(file, wadHeader, index);

    const { info, points: simplePoints, endpoints } = chunks;
    let lines = defined(chunks.lines, 'No LINS chunk');
    let sides = defined(chunks.sides, 'No SIDS chuhnk');
    let polygons = defined(chunks.polygons, 'No POLY chunk');

    if (!info) {
        throw new Error('No map info chunk found');
    }

    let points: Vec2[];
    if (simplePoints) {
        points = simplePoints;
    } else if (endpoints) {
        points = endpoints.map((endpoint: Endpoint) => {
            return endpoint.position;
        });
    } else {
        throw Error('No EPNT or PNTS chunk');
    }

    let platforms: Platform[];
    if (chunks.dynamicPlatforms) {
        platforms = chunks.dynamicPlatforms.map(dynamicPlatform => {
            return dynamicPlatform.toStatic();
        });

        platforms = platforms.filter(platform =>
            polygons[platform.polygonIndex] !== undefined);

        platforms.forEach(platform => {
            const { polygonIndex } = platform;
            if (polygonIndex >= 0 && polygonIndex < polygons.length) {
                let polygon = polygons[polygonIndex];
                assertDefined(
                    polygon,
                    'platform references nonexistent polygon'
                );
                if (platform.comesFromFloor()) {
                    polygon = polygon.patch({
                        floorHeight: platform.minimumHeight
                    });
                }
                if (platform.comesFromCeiling()) {
                    polygon = polygon.patch({
                        ceilingHeight: platform.maximumHeight
                    });
                }
                polygons[polygonIndex] = polygon;
            } else {
                console.warn(`Can't fixup platform polygon: ${polygonIndex} out of range`);
            }
        });
    } else {
        platforms = chunks.platforms || [];
    }

    lines = lines.map(line => {
        const polygonIndexes = [line.backPoly, line.frontPoly].filter(idx => idx !== -1);
        const linePolygons = polygonIndexes.map(idx => polygons[idx]);

        if (linePolygons.length === 0) {
            line = line.patch({
                lowestCeiling: 0,
                highestFloor: 0,
            });
        } else {
            const lowestCeiling = linePolygons.reduce(
                (ceiling, polygon) => Math.min(ceiling, polygon.ceilingHeight),
                0x7fff);
            const highestFloor = linePolygons.reduce(
                (floor, polygon) => Math.max(floor, polygon.floorHeight),
                -0x8000);
            line = line.patch({ lowestCeiling, highestFloor });
        }

        line = line.patchFlag(
            LineFlag.solid,
            line.highestFloor >= line.lowestCeiling
        );

        return line;
    });

    sides = sides.map(side => side.patch({
        collisionBottomLeft: [0, 0],
        collisionBottomRight: [0, 0],
        collisionTopLeft: [0, 0],
        collisionTopRight: [0, 0],
    }));

    polygons = polygons.map(polygon => polygon.patch({
        center: [0, 0],
        area: 0,
    }));

    return {
        header: wadHeader,
        index,
        info,
        points,
        lines,
        polygons,
        sides: chunks.sides || [],
        lights: chunks.lights || [],
        media: chunks.media || [],
        objects: chunks.objects || [],
        itemPlacement: chunks.itemPlacement || [],
        ambientSounds: chunks.ambientSounds || [],
        randomSounds: chunks.randomSounds || [],
        platforms,
        notes: chunks.notes || []
    };
}

function serializeArray<T extends SerializerInstance>(objects: T[]): ArrayBuffer {
    const writer = new ArrayBufferWriter();
    for (const obj of objects) {
        obj.write(writer);
    }
    return writer.getBuffer();
}

const writeChunkHeaderSize = 16;

function serializeChunk(writer: Writer, type: string, data: ArrayBuffer, isLastChunk = false) {
    const chunkStart = writer.position();
    const nextChunkOffset = chunkStart + writeChunkHeaderSize + data.byteLength;
    writer.fixString(4, type);
    writer.uint32(isLastChunk ? 0 : nextChunkOffset);
    writer.uint32(data.byteLength);
    writer.zeros(4);
    writer.bytes(data);
}

export function serializeMap(map: MapGeometry): ArrayBuffer {
    const infoChunkWriter = new ArrayBufferWriter();
    map.info.write(infoChunkWriter);
    const infoChunk = infoChunkWriter.getBuffer();
    const pointsChunk = serializePoints(map.points);
    const linesChunk = serializeArray(map.lines);
    const polygonsChunk = serializeArray(map.polygons);
    const sidesChunk = serializeArray(map.sides);
    const lightsChunk = serializeArray(map.lights);
    const mediaChunk = serializeArray(map.media);
    const objectsChunk = serializeArray(map.objects);
    const itemPlacementChunk = serializeArray(map.itemPlacement);
    const ambientSoundsChunk = serializeArray(map.ambientSounds);
    const randomSoundsChunk = serializeArray(map.randomSounds);
    const platformsChunk = serializeArray(map.platforms);
    const notesChunk = serializeArray(map.notes);

    const writer = new ArrayBufferWriter();
    serializeChunk(writer, 'Minf', infoChunk);
    serializeChunk(writer, 'PNTS', pointsChunk);
    serializeChunk(writer, 'LINS', linesChunk);
    serializeChunk(writer, 'POLY', polygonsChunk);
    serializeChunk(writer, 'SIDS', sidesChunk);
    serializeChunk(writer, 'LITE', lightsChunk);
    serializeChunk(writer, 'medi', mediaChunk);
    serializeChunk(writer, 'OBJS', objectsChunk);
    serializeChunk(writer, 'plac', itemPlacementChunk);
    serializeChunk(writer, 'ambi', ambientSoundsChunk);
    serializeChunk(writer, 'bonk', randomSoundsChunk);
    serializeChunk(writer, 'plat', platformsChunk);
    serializeChunk(writer, 'NOTE', notesChunk, true);

    return writer.getBuffer();
}

