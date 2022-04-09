import { Vec2, v2add, v2sub } from '../../vector2';
import { Side, SideTex } from './side';
import { Polygon } from './polygon';
import { Light } from './light';
import { MapObject } from './object';
import { Line } from './line';
import { ItemPlacement } from './item-placement';
import { Media } from './media';
import { AmbientSound } from './ambient-sound';
import { RandomSound } from './random-sound';
import { Note } from './note';
import { Platform } from './platform';
import { MapInfo } from './map-info';
import { TransferMode, WadHeader } from '../wad';
import { Dependencies } from './dependencies';
import { Remapping } from './index-remap';
import { polygonsAt } from '../../geometry';

interface FloorCeilingRequest {
    polygonIndex: number,
    shape: number,
    offset: Vec2,
}

type TextureSlot = 'primary' | 'secondary' | 'transparent'

interface WallTextureRequest {
    polygonIndex: number,
    wallIndex: number,
    sideType: number,
    textureSlot: TextureSlot,
    shape: number,
    offset: Vec2,
    transferMode?: TransferMode
}

interface MapGeometryConstructor {
    index: number;
    header: WadHeader;
    info: MapInfo;
    points: Vec2[];
    lights: Light[];
    lines: Line[];
    sides: Side[];
    polygons: Polygon[];
    media: Media[];
    objects: MapObject[];
    itemPlacement: ItemPlacement[];
    ambientSounds: AmbientSound[];
    randomSounds: RandomSound[];
    notes: Note[];
    platforms: Platform[];
}

function outOfRange(pt: Vec2): boolean {
    return pt[0] < -0x8000 || pt[0] > 0x7fff ||
        pt[1] < -0x8000 || pt[1] > 0x7fff;
}

export class MapGeometry {
    index: number;
    header: WadHeader;
    info: MapInfo;
    points: Vec2[];
    lights: Light[];
    lines: Line[];
    sides: Side[];
    polygons: Polygon[];
    media: Media[];
    objects: MapObject[];
    itemPlacement: ItemPlacement[];
    ambientSounds: AmbientSound[];
    randomSounds: RandomSound[];
    notes: Note[];
    platforms: Platform[];

    constructor(data: MapGeometryConstructor) {
        this.index = data.index;
        this.header = data.header;
        this.info = data.info;
        this.points = data.points;
        this.lights = data.lights;
        this.lines = data.lines;
        this.sides = data.sides;
        this.polygons = data.polygons;
        this.media = data.media;
        this.objects = data.objects;
        this.itemPlacement = data.itemPlacement;
        this.ambientSounds = data.ambientSounds;
        this.randomSounds = data.randomSounds;
        this.notes = data.notes;
        this.platforms = data.platforms;
    }

    movePoint(i: number, [x, y]: Vec2): MapGeometry {
        const newPoints = [...this.points];
        newPoints[i] = [Math.floor(x), Math.floor(y)];
        if (outOfRange(newPoints[i])) {
            return this;
        } else {
            return new MapGeometry({ ...this, points: newPoints });
        }
    }

    neighboringPolygons(lineIndex: number) {
        const polygon = this.polygons[lineIndex];
        if (!polygon) {
            throw new Error(`invalid polygon ${lineIndex}`);
        }
        const neighbors = [];
        for (const lineIndex of polygon.lines) {
            if (lineIndex !== -1) {
                const line = this.lines[lineIndex];
                if (!line) {
                    throw new Error(`invalid line ${lineIndex}`);
                }
                if (line.frontPoly === lineIndex && line.backPoly !== -1) {
                    neighbors.push(line.backPoly);
                } else if (line.backPoly === lineIndex && line.frontPoly !== -1) {
                    neighbors.push(line.frontPoly);
                }
            }
        }
        return neighbors;
    }

    *floodBreadthFirst(startingPolyIndex: number): Generator<number> {
        const visitedIndexes = new Set<number>();
        const queue = [startingPolyIndex];
        while (queue.length !== 0) {
            const idx = queue.shift();
            if (typeof idx === 'number' && !visitedIndexes.has(idx)) {
                visitedIndexes.add(idx);
                for (const neighborIdx of this.neighboringPolygons(idx)) {
                    queue.push(neighborIdx);
                }
                yield idx;
            }
        }
    }

    findNewContainingPolygon(point: Vec2, oldPolygonIndex: number): number {
        const containingPolygons = polygonsAt(point, this);
        if (containingPolygons.length === 0) {
            return -1;
        }

        for (const polyIndex of this.floodBreadthFirst(oldPolygonIndex)) {
            if (containingPolygons.includes(polyIndex)) {
                return polyIndex;
            }
        }

        // not found in flood, must not be connected to us at all. just pick one
        return containingPolygons[0];
    }

    moveObject(i: number, [x, y]: Vec2): MapGeometry {
        // FIXME user can move object outside of containing polygon
        const newObjects = [...this.objects];
        const newPosition: Vec2 = [Math.floor(x), Math.floor(y)];
        const z = this.objects[i].position[2];
        if (outOfRange(newPosition)) {
            return this;
        } else {
            const oldObject = this.objects[i];
            const oldPolygon = oldObject.polygon;
            const containingPolygon = this.findNewContainingPolygon(newPosition, oldPolygon);
            const polygon = containingPolygon === -1 ? oldPolygon : containingPolygon;
            newObjects[i] = new MapObject({
                ...oldObject,
                position: [newPosition[0], newPosition[1], z],
                polygon
            });
            return new MapGeometry({ ...this, objects: newObjects });
        }
    }

    movePolygon(polyIdx: number, position: Vec2): MapGeometry {
        const polygon = this.polygons[polyIdx];
        const referencePos = this.points[polygon.endpoints[0]];
        const offset = v2sub(position, referencePos);
        const newPoints = [...this.points];
        for (const ptIdx of polygon.endpoints) {
            newPoints[ptIdx] = v2add(newPoints[ptIdx], offset).map(x =>
                Math.floor(x)) as Vec2;
            if (outOfRange(newPoints[ptIdx])) {
                return this;
            }
        }
        return new MapGeometry({ ...this, points: newPoints });
    }

    getWallTexInfo(
        polygonIndex: number,
        wallIndex: number,
        textureSlot: 'primary' | 'secondary'
    ): null | { light: Light } {
        const polygon = this.polygons[polygonIndex];
        const sideIndex = polygon.sides[wallIndex];
        if (sideIndex === -1) {
            return null;
        } else {
            const side = this.sides[sideIndex];
            let lightIndex;
            if (textureSlot === 'primary') {
                lightIndex = side.primaryLightsourceIndex;
            } else if (textureSlot === 'secondary') {
                lightIndex = side.secondaryLightsourceIndex;
            } else {
                throw new Error(`invalid texture slot ${textureSlot}`);
            }

            const light = this.lights[lightIndex];
            return { light };
        }
    }

    setWallTexture({
        polygonIndex,
        wallIndex,
        sideType,
        textureSlot,
        shape,
        offset,
        transferMode = TransferMode.normal
    }: WallTextureRequest): MapGeometry {
        const sideTex = new SideTex({ texture: shape, offset });
        const polygon = this.polygons[polygonIndex];
        const sideIndex = polygon.sides[wallIndex];
        if (sideIndex == -1) {
            const side = new Side({
                type: sideType,
                polygonIndex,
                lineIndex: polygon.lines[wallIndex],
                primaryTexture: textureSlot === 'primary' ? sideTex : new SideTex(),
                secondaryTexture: textureSlot === 'secondary' ? sideTex : new SideTex(),
                transparentTexture: textureSlot === 'transparent' ? sideTex : new SideTex(),
                primaryTransferMode: textureSlot === 'primary' ? transferMode : TransferMode.normal,
                secondaryTransferMode: textureSlot === 'secondary' ? transferMode : TransferMode.normal,
                transparentTransferMode: textureSlot === 'transparent' ? transferMode : TransferMode.normal,
            });
            const sides = [...this.sides, side];
            const polygonSides = [...polygon.sides];
            polygonSides[wallIndex] = sides.length - 1;

            const newPolygon = new Polygon({
                ...polygon,
                sides: polygonSides
            });
            const polygons = [...this.polygons];
            polygons[polygonIndex] = newPolygon;

            return new MapGeometry({ ...this, sides, polygons });
        } else {
            const oldSide = this.sides[sideIndex];
            const side = new Side({
                ...oldSide,
                primaryTexture: textureSlot === 'primary' ? sideTex : oldSide.primaryTexture,
                secondaryTexture: textureSlot === 'secondary' ? sideTex : oldSide.secondaryTexture,
                transparentTexture: textureSlot === 'transparent' ? sideTex : oldSide.transparentTexture,
                primaryTransferMode: textureSlot === 'primary'
                    ? transferMode : oldSide.primaryTransferMode,
                secondaryTransferMode: textureSlot === 'secondary'
                    ? transferMode : oldSide.secondaryTransferMode,
                transparentTransferMode: textureSlot === 'transparent'
                    ? transferMode : oldSide.transparentTransferMode,
            });
            const sides = [...this.sides];
            sides[sideIndex] = side;
            return new MapGeometry({ ...this, sides });
        }
    }

    setFloorTexture({ polygonIndex, shape, offset }: FloorCeilingRequest): MapGeometry {
        const polygons = [...this.polygons];
        polygons[polygonIndex] = new Polygon({
            ...polygons[polygonIndex],
            floorTexture: shape,
            floorOrigin: offset,
            floorTransferMode: TransferMode.normal,
        });
        return new MapGeometry({ ...this, polygons });
    }

    setCeilingTexture({ polygonIndex, shape, offset }: FloorCeilingRequest): MapGeometry {
        const polygons = [...this.polygons];
        polygons[polygonIndex] = new Polygon({
            ...polygons[polygonIndex],
            ceilingTexture: shape,
            ceilingOrigin: offset,
            ceilingTransferMode: TransferMode.normal,
        });
        return new MapGeometry({ ...this, polygons });
    }

    removeObjectsAndRenumber(deadObjects: Dependencies): MapGeometry {
        const mappings = new Remapping(this, deadObjects);
        const newArrays = mappings.remap();
        return new MapGeometry({
            index: this.index,
            header: this.header,
            info: this.info,
            ...newArrays,
        });
    }

    deletePolygon(polygonIdx: number): MapGeometry {
        const deletions = new Dependencies();
        deletions.addPolygon(this, polygonIdx);
        return this.removeObjectsAndRenumber(deletions);
    }

    deleteLine(pointIdx: number): MapGeometry {
        const deletions = new Dependencies();
        deletions.addLine(this, pointIdx);
        return this.removeObjectsAndRenumber(deletions);
    }

    deletePoint(pointIdx: number): MapGeometry {
        const deletions = new Dependencies();
        deletions.addPoint(this, pointIdx);
        return this.removeObjectsAndRenumber(deletions);
    }

    deleteObject(objectIdx: number): MapGeometry {
        const deletions = new Dependencies();
        deletions.addObject(this, objectIdx);
        return this.removeObjectsAndRenumber(deletions);
    }

    getConnectedPoints(pointIdx: number): number[] {
        if (pointIdx < 0 || pointIdx >= this.points.length) {
            return [];
        } else {
            const points: number[] = [];
            this.lines.forEach(line => {
                if (line.begin === pointIdx) {
                    points.push(line.end);
                } else if (line.end === pointIdx) {
                    points.push(line.begin);
                }
            });
            return points;
        }
    }
}
