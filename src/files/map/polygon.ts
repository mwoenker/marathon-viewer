import { readList, readPoint, writePoint } from './utils';
import { Vec2 } from '../../vector2';
import { Reader } from '../binary-read';
import { Writer } from '../binary-write';
import { TransferMode } from '../wad';

export const maxVertices = 8;

export interface PolygonConstructor {
    type?: number;
    flags?: number;
    permutation?: number;
    vertexCount?: number;
    endpoints: number[];
    lines: number[];
    floorTexture?: number;
    ceilingTexture?: number;
    floorHeight: number;
    ceilingHeight: number;
    floorLightsource?: number;
    ceilingLightsource?: number;
    area?: number;
    firstObject?: number;
    firstExclusionZone?: number;
    nLineExclusionZones?: number;
    nPointExclusionZones?: number;
    floorTransferMode?: number;
    ceilingTransferMode?: number;
    adjacentPolygons?: number[];
    firstNeighbor?: number;
    nNeighbors?: number;
    center?: Vec2;
    sides?: number[];
    floorOrigin?: Vec2;
    ceilingOrigin?: Vec2;
    media?: number;
    mediaLightsource?: number;
    firstSoundSource?: number;
    ambientSound?: number;
    randomSound?: number;
}

export class Polygon {
    readonly type: number;
    readonly flags: number;
    readonly permutation: number;
    readonly vertexCount: number;
    readonly endpoints: number[];
    readonly lines: number[];
    readonly floorTexture: number;
    readonly ceilingTexture: number;
    readonly floorHeight: number;
    readonly ceilingHeight: number;
    readonly floorLightsource: number;
    readonly ceilingLightsource: number;
    readonly area: number;
    readonly firstObject: number;
    readonly firstExclusionZone: number;
    readonly nLineExclusionZones: number;
    readonly nPointExclusionZones: number;
    readonly floorTransferMode: number;
    readonly ceilingTransferMode: number;
    readonly adjacentPolygons: number[];
    readonly firstNeighbor: number;
    readonly nNeighbors: number;
    readonly center: Vec2;
    readonly sides: number[];
    readonly floorOrigin: Vec2;
    readonly ceilingOrigin: Vec2;
    readonly media: number;
    readonly mediaLightsource: number;
    readonly firstSoundSource: number;
    readonly ambientSound: number;
    readonly randomSound: number;

    constructor(data: PolygonConstructor) {
        this.type = data.type ?? 0;
        this.flags = data.flags ?? 0;
        this.permutation = data.permutation ?? 0;
        this.vertexCount = data.vertexCount ?? data.lines.length;
        this.endpoints = data.endpoints;
        this.lines = data.lines;
        this.floorTexture = data.floorTexture ?? 0xffff;
        this.ceilingTexture = data.ceilingTexture ?? 0xffff;
        this.floorHeight = data.floorHeight;
        this.ceilingHeight = data.ceilingHeight;
        this.floorLightsource = data.floorLightsource ?? 0;
        this.ceilingLightsource = data.ceilingLightsource ?? 0;
        this.area = data.area ?? 0;
        this.firstObject = data.firstObject ?? -1;
        this.firstExclusionZone = data.firstExclusionZone ?? 0;
        this.nLineExclusionZones = data.nLineExclusionZones ?? 0;
        this.nPointExclusionZones = data.nPointExclusionZones ?? 0;
        this.floorTransferMode = data.floorTransferMode ?? TransferMode.normal;
        this.ceilingTransferMode = data.ceilingTransferMode ?? TransferMode.normal;
        this.adjacentPolygons = data.adjacentPolygons ?? data.lines.map(() => -1);
        this.firstNeighbor = data.firstNeighbor ?? 0;
        this.nNeighbors = data.nNeighbors ?? 0;
        this.center = data.center ?? [0, 0];
        this.sides = data.sides ?? data.lines.map(() => -1);
        this.floorOrigin = data.floorOrigin ?? [0, 0];
        this.ceilingOrigin = data.ceilingOrigin ?? [0, 0];
        this.media = data.media ?? -1;
        this.mediaLightsource = data.mediaLightsource ?? 0;
        this.firstSoundSource = data.firstSoundSource ?? -1;
        this.ambientSound = data.ambientSound ?? -1;
        this.randomSound = data.randomSound ?? -1;
    }

    patch(update: Partial<PolygonConstructor>): Polygon {
        return new Polygon({ ...this, ...update });
    }

    static read(r: Reader): Polygon {
        // Read 8 shorts, but only return the first $nVertices
        const readPolyIndices = (nVertices: number) =>
            readList(maxVertices, () => r.int16()).slice(0, nVertices);

        const type = r.int16();
        const flags = r.int16();
        const permutation = r.int16();
        const vertexCount = r.uint16();

        const polygon = new Polygon({
            type,
            flags,
            permutation,
            vertexCount,
            endpoints: readPolyIndices(vertexCount),
            lines: readPolyIndices(vertexCount),
            floorTexture: r.uint16(),
            ceilingTexture: r.uint16(),
            floorHeight: r.int16(),
            ceilingHeight: r.int16(),
            floorLightsource: r.int16(),
            ceilingLightsource: r.int16(),
            area: r.int32(),
            firstObject: r.int16(),
            firstExclusionZone: r.int16(),
            nLineExclusionZones: r.int16(),
            nPointExclusionZones: r.int16(),
            floorTransferMode: r.int16(),
            ceilingTransferMode: r.int16(),
            adjacentPolygons: readPolyIndices(vertexCount),
            firstNeighbor: r.int16(),
            nNeighbors: r.int16(),
            center: readPoint(r),
            sides: readPolyIndices(vertexCount),
            floorOrigin: readPoint(r),
            ceilingOrigin: readPoint(r),
            media: r.int16(),
            mediaLightsource: r.int16(),
            firstSoundSource: r.int16(),
            ambientSound: r.int16(),
            randomSound: r.int16(),
        });

        r.skip(2);

        return polygon;
    }

    write(writer: Writer): void {
        const writePolyIndices = (indices: number[]): void => {
            for (let i = 0; i < maxVertices; ++i) {
                if (i >= indices.length) {
                    writer.int16(0);
                } else {
                    writer.int16(indices[i]);
                }
            }
        };

        writer.int16(this.type);
        writer.int16(this.flags);
        writer.int16(this.permutation);
        writer.uint16(this.vertexCount);
        writePolyIndices(this.endpoints);
        writePolyIndices(this.lines);
        writer.uint16(this.floorTexture);
        writer.uint16(this.ceilingTexture);
        writer.int16(this.floorHeight);
        writer.int16(this.ceilingHeight);
        writer.int16(this.floorLightsource);
        writer.int16(this.ceilingLightsource);
        writer.int32(this.area);
        writer.int16(this.firstObject);
        writer.int16(this.firstExclusionZone);
        writer.int16(this.nLineExclusionZones);
        writer.int16(this.nPointExclusionZones);
        writer.int16(this.floorTransferMode);
        writer.int16(this.ceilingTransferMode);
        writePolyIndices(this.adjacentPolygons);
        writer.int16(this.firstNeighbor);
        writer.int16(this.nNeighbors);
        writePoint(writer, this.center);
        writePolyIndices(this.sides);
        writePoint(writer, this.floorOrigin);
        writePoint(writer, this.ceilingOrigin);
        writer.int16(this.media);
        writer.int16(this.mediaLightsource);
        writer.int16(this.firstSoundSource);
        writer.int16(this.ambientSound);
        writer.int16(this.randomSound);

        writer.zeros(2);
    }
}
