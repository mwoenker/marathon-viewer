import { RandomAccess, Reader, readRange, Writer } from './binary-read';

import { readPoint, writePoint } from './map/utils';
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
import { Vec2 } from '../vector2';
import { WadHeader } from './wad';

interface SerializerInstance {
    write(writer: Writer): void
}

interface SerializerClass<InstanceType extends SerializerInstance> {
    read(reader: Reader): InstanceType
}

const pointsSerializer = {
    read(reader: Reader, chunkSize: number) {
        const points: Vec2[] = [];
        const startPos = reader.pos;
        while (reader.pos - startPos < chunkSize) {
            points.push(readPoint(reader));
        }
        return points;
    },
    write(writer: Writer, points: Vec2[]) {
        for (const point of points) {
            writePoint(writer, point);
        }
    }
};

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
            chunks.points = pointsSerializer.read(chunkReader, data.byteLength);
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
        }

        if (chunkHeader.nextOffset <= chunkStart) {
            break;
        }

        chunkStart = chunkHeader.nextOffset;
    }

    return chunks;
}

interface Map extends Chunks {
    header: WadHeader,
    index: number,
}

export async function readMap(
    file: RandomAccess,
    wadHeader: WadHeader,
    index: number
): Promise<Map> {
    const chunks = await readEntryChunks(file, wadHeader, index);

    const { info, points: simplePoints, endpoints, lines, sides, polygons } = chunks;
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

    if (!lines) {
        throw Error('No LINS chunk');
    }

    if (!sides) {
        throw Error('No SIDS chunk');
    }

    if (!polygons) {
        throw Error('No POLY chunk');
    }

    console.log('CHUNKS!!!!!!!!!!!!!!!!!!!!', chunks)

    return {
        header: wadHeader,
        index,
        info,
        points,
        lines,
        polygons,
        endpoints: chunks.endpoints || [],
        sides: chunks.sides || [],
        lights: chunks.lights || [],
        media: chunks.media || [],
        objects: chunks.objects || [],
        itemPlacement: chunks.itemPlacement || [],
        ambientSounds: chunks.ambientSounds || [],
        randomSounds: chunks.randomSounds || [],
        platforms: chunks.platforms || [],
        notes: chunks.notes || []
    };
}

