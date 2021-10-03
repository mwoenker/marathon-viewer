import { readList, readPoint, writePoint } from './utils';
import { Vec2 } from '../../vector2'
import { Reader, Writer } from '../binary-read'

export const maxVertices = 8;

export interface PolygonConstructor {
    type: number;
    flags: number;
    permutation: number;
    vertexCount: number;
    endpoints: number[];
    lines: number[];
    floorTexture: number;
    ceilingTexture: number;
    floorHeight: number;
    ceilingHeight: number;
    floorLightsource: number;
    ceilingLightsource: number;
    area: number;
    firstObject: number;
    firstExclusionZone: number;
    nLineExclusionZones: number;
    nPointExclusionZones: number;
    floorTransferMode: number;
    ceilingTransferMode: number;
    adjacentPolygons: number[];
    firstNeighbor: number;
    nNeighbors: number;
    center: Vec2;
    sides: number[];
    floorOrigin: Vec2;
    ceilingOrigin: Vec2;
    media: number;
    mediaLightsource: number;
    firstSoundSource: number;
    ambientSound: number;
    randomSound: number;
}

export class Polygon {
    type: number;
    flags: number;
    permutation: number;
    vertexCount: number;
    endpoints: number[];
    lines: number[];
    floorTexture: number;
    ceilingTexture: number;
    floorHeight: number;
    ceilingHeight: number;
    floorLightsource: number;
    ceilingLightsource: number;
    area: number;
    firstObject: number;
    firstExclusionZone: number;
    nLineExclusionZones: number;
    nPointExclusionZones: number;
    floorTransferMode: number;
    ceilingTransferMode: number;
    adjacentPolygons: number[];
    firstNeighbor: number;
    nNeighbors: number;
    center: Vec2;
    sides: number[];
    floorOrigin: Vec2;
    ceilingOrigin: Vec2;
    media: number;
    mediaLightsource: number;
    firstSoundSource: number;
    ambientSound: number;
    randomSound: number;

    constructor(data: PolygonConstructor) {
        this.type = data.type;
        this.flags = data.flags;
        this.permutation = data.permutation;
        this.vertexCount = data.vertexCount;
        this.endpoints = data.endpoints;
        this.lines = data.lines;
        this.floorTexture = data.floorTexture;
        this.ceilingTexture = data.ceilingTexture;
        this.floorHeight = data.floorHeight;
        this.ceilingHeight = data.ceilingHeight;
        this.floorLightsource = data.floorLightsource;
        this.ceilingLightsource = data.ceilingLightsource;
        this.area = data.area;
        this.firstObject = data.firstObject;
        this.firstExclusionZone = data.firstExclusionZone;
        this.nLineExclusionZones = data.nLineExclusionZones;
        this.nPointExclusionZones = data.nPointExclusionZones;
        this.floorTransferMode = data.floorTransferMode;
        this.ceilingTransferMode = data.ceilingTransferMode;
        this.adjacentPolygons = data.adjacentPolygons;
        this.firstNeighbor = data.firstNeighbor;
        this.nNeighbors = data.nNeighbors;
        this.center = data.center;
        this.sides = data.sides;
        this.floorOrigin = data.floorOrigin;
        this.ceilingOrigin = data.ceilingOrigin;
        this.media = data.media;
        this.mediaLightsource = data.mediaLightsource;
        this.firstSoundSource = data.firstSoundSource;
        this.ambientSound = data.ambientSound;
        this.randomSound = data.randomSound;
    }

    static read(r: Reader): Polygon {
        // Read 8 shorts, but only return the first $nVertices
        const readPolyIndices = (nVertices: number) =>
            readList(maxVertices, () => r.int16()).slice(0, nVertices);

        const type = r.uint16();
        const flags = r.uint16();
        const permutation = r.uint16();
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
            firstObject: r.uint16(),
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
            mediaLightsource: r.uint16(),
            firstSoundSource: r.uint16(),
            ambientSound: r.uint16(),
            randomSound: r.uint16(),
        });

        r.skip(2);

        return polygon;
    }

    write(writer: Writer): void {
        const writePolyIndices = (indices: number[]): void => {
            for (let i = 0; i < maxVertices; ++i) {
                if (i >= indices.length) {
                    writer.int16(-1);
                } else {
                    writer.int16(indices[i]);
                }
            }
        };

        writer.uint16(this.type);
        writer.uint16(this.flags);
        writer.uint16(this.permutation);
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
        writer.uint16(this.firstObject);
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
        writePoint(writer, this.ceilingOrigin)
        writer.int16(this.media);
        writer.uint16(this.mediaLightsource);
        writer.uint16(this.firstSoundSource);
        writer.uint16(this.ambientSound);
        writer.uint16(this.randomSound);

        writer.zeros(2);
    }
}
