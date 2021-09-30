import { readList, writeList } from './utils';

export const maxVertices = 8;

export class Polygon {
    constructor({
        type,
        flags,
        permutation,
        vertexCount,
        endpoints,
        lines,
        floorTexture,
        ceilingTexture,
        floorHeight,
        ceilingHeight,
        floorLightsource,
        ceilingLightsource,
        area,
        firstObject,
        firstExclusionZone,
        nLineExclusionZones,
        nPointExclusionZones,
        floorTransferMode,
        ceilingTransferMode,
        adjacentPolygons,
        firstNeighbor,
        nNeighbors,
        center,
        sides,
        floorOrigin,
        ceilingOrigin,
        media,
        mediaLightsource,
        firstSoundSource,
        ambientSound,
        randomSound,
    }) {
        this.type = type;
        this.flags = flags;
        this.permutation = permutation;
        this.vertexCount = vertexCount;
        this.endpoints = endpoints;
        this.lines = lines;
        this.floorTexture = floorTexture;
        this.ceilingTexture = ceilingTexture;
        this.floorHeight = floorHeight;
        this.ceilingHeight = ceilingHeight;
        this.floorLightsource = floorLightsource;
        this.ceilingLightsource = ceilingLightsource;
        this.area = area;
        this.firstObject = firstObject;
        this.firstExclusionZone = firstExclusionZone;
        this.nLineExclusionZones = nLineExclusionZones;
        this.nPointExclusionZones = nPointExclusionZones;
        this.floorTransferMode = floorTransferMode;
        this.ceilingTransferMode = ceilingTransferMode;
        this.adjacentPolygons = adjacentPolygons;
        this.firstNeighbor = firstNeighbor;
        this.nNeighbors = nNeighbors;
        this.center = center;
        this.sides = sides;
        this.floorOrigin = floorOrigin;
        this.ceilingOrigin = ceilingOrigin;
        this.media = media;
        this.mediaLightsource = mediaLightsource;
        this.firstSoundSource = firstSoundSource;
        this.ambientSound = ambientSound;
        this.randomSound = randomSound;
    }

    read(r) {
        // Read 8 shorts, but only return the first $nVertices
        const readPolyIndices = (nVertices) =>
            readList(maxVertices, () => r.int16()).slice(0, nVertices);

        const polygon = new Polygon({
            type: r.uint16(),
            flags: r.uint16(),
            permutation: r.uint16(),
            vertexCount: r.uint16(),
            endpoints: readPolyIndices(polygon.vertexCount),
            lines: readPolyIndices(polygon.vertexCount),
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
            adjacentPolygons: readPolyIndices(polygon.vertexCount),
            firstNeighbor: r.int16(),
            nNeighbors: r.int16(),
            center: readList(2, () => r.uint16()),
            sides: readPolyIndices(polygon.vertexCount),
            floorOrigin: readList(2, () => r.uint16()),
            ceilingOrigin: readList(2, () => r.uint16()),
            media: r.int16(),
            mediaLightsource: r.uint16(),
            firstSoundSource: r.uint16(),
            ambientSound: r.uint16(),
            randomSound: r.uint16(),
        });

        r.skip(2);

        return polygon;
    }

    write(writer) {
        const writePolyIndices = (indices) => {
            for (let i; i < maxVertices; ++i) {
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
        writeList(this.center, () => writer.uint16());
        writePolyIndices(this.sides);
        writeList(this.floorOrigin, () => writer.uint16());
        writeList(this.ceilingOrigin, () => writer.uint16());
        writer.int16(this.media);
        writer.uint16(this.mediaLightsource);
        writer.uint16(this.firstSoundSource);
        writer.uint16(this.ambientSound);
        writer.uint16(this.randomSound);

        writer.zeros(2);
    }
}
