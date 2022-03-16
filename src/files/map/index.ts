import { Vec2, v2add, v2sub } from '../../vector2';
import { Side, SideTex } from './side';
import { Polygon } from './polygon';
import { Light } from './light';
import { MapObject } from './object';
import { Line } from './line';
import { ItemPlacement } from './item-placement';
import { Endpoint } from './endpoint';
import { Media } from './media';
import { AmbientSound } from './ambient-sound';
import { RandomSound } from './random-sound';
import { Note } from './note';
import { Platform } from './platform';
import { MapInfo } from './map-info';
import { TransferMode, WadHeader } from '../wad';

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

// Holds sets of object indices
class Dependencies {
    objects: Map<string, number[]>

    constructor() {
        this.objects = new Map();
    }

    // Add object, but not its dependencies. Returns true if object is already
    // in list.
    _add(type: string, index: number): boolean {
        if (!this.objects.has(type)) {
            this.objects.set(type, [index]);
            return true;
        } else {
            const typeObjs = this.objects.get(type);
            if (typeObjs && !typeObjs.includes(index)) {
                typeObjs.push(index);
                return true;
            } else {
                return false;
            }
        }
    }

    objectsOfType(type: string): number[] {
        return this.objects.get(type) || [];
    }

    includes(type: string, index: number): boolean {
        return this.objectsOfType(type).includes(index);
    }

    // Functions to add an object, plus recursively all its dependencies. An
    // object B is dependent on object A if B must be deleted when A is deleted
    // -- i.e. a line is dependent on its two endpoints because when one of its
    // endpoints is deleted, the line can no longer exist.

    addPoint(map: MapGeometry, pointIndex: number) {
        if (this._add('points', pointIndex)) {
            for (let i = 0; i < map.lines.length; ++i) {
                const line = map.lines[i];
                if (pointIndex === line.begin || pointIndex === line.end) {
                    this.addLine(map, i);
                }
            }
        }
    }
    addLine(map: MapGeometry, lineIndex: number): void {
        if (this._add('lines', lineIndex)) {
            const line = map.lines[lineIndex];
            if (-1 !== line.frontSide) {
                this.addSide(map, line.frontSide);
            }
            if (-1 !== line.backSide) {
                this.addSide(map, line.backSide);
            }
            if (-1 !== line.frontPoly) {
                this.addPolygon(map, line.frontPoly);
            }
            if (-1 !== line.backPoly) {
                this.addPolygon(map, line.backPoly);
            }
        }
    }
    addSide(map: MapGeometry, sideIndex: number): void {
        if (this._add('sides', sideIndex)) {
            const side = map.sides[sideIndex];
            if (-1 !== side.polygonIndex) {
                this.addPolygon(map, side.polygonIndex);
            }
        }
    }
    addPolygon(map: MapGeometry, polygonIndex: number): void {
        if (this._add('polygons', polygonIndex)) {
            const polygon = map.polygons[polygonIndex];
            for (const sideIndex of polygon.sides) {
                if (-1 !== sideIndex) {
                    this.addSide(map, sideIndex);
                }
            }
            for (let i = 0; i < map.objects.length; ++i) {
                if (map.objects[i].polygon === polygonIndex) {
                    this.addObject(map, i);
                }
            }
            for (let i = 0; i < map.notes.length; ++i) {
                if (map.notes[i].polygonIndex === polygonIndex) {
                    this.addNote(map, i);
                }
            }
        }
    }
    addObject(map: MapGeometry, objectIndex: number): void {
        this._add('objects', objectIndex);
    }
    addNote(map: MapGeometry, noteIndex: number): void {
        this._add('notes', noteIndex);
    }
}

const objectTypes = [
    'points',
    'lines',
    'sides',
    'polygons',
    'lights',
    'objects',
    'itemPlacement',
    'media',
    'ambientSounds',
    'randomSounds',
    'platforms',
    'notes',
];

// return new object with updates merged into original. If updates don't
// actually change any values of the original, return the original unchanged
function updateObject(original: any, updates: any): any {
    function compare(a: any, b: any): boolean {
        // return true if objects are the same or are arrays with identical
        // elements
        if (a === b) {
            return true;
        } else if (Array.isArray(a) && Array.isArray(b)
            && a.length === b.length) {
            for (let i = 0; i < a.length; ++i) {
                if (a[i] !== b[i]) {
                    return false;
                }
            }
            return true;
        } else {
            return false;
        }
    }

    for (const prop in updates) {
        if (!compare(original[prop], updates[prop])) {
            return { ...original, ...updates };
        }
    }
    return original;
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
        type indexMap = { [type: string]: number[] }
        type objectMap = { [type: string]: any[] }
        const newIndices: indexMap = {};
        const newObjects: objectMap = {};

        // For each object type, calculate new object arrays w/o the dead
        // objects and a index array mapping the old indexes to the new. Dead
        // objects are assigned index -1
        for (const type of objectTypes) {
            // a whole lot of type unsave hackery
            const objectsByType = this as any;
            const objectsOfType = objectsByType[type] as any[];
            newIndices[type] = new Array(objectsOfType.length);
            newObjects[type] = new Array(
                objectsOfType.length - deadObjects.objectsOfType(type).length);
            for (let i = 0, newIndex = 0; i < objectsOfType.length; ++i) {
                if (deadObjects.includes(type, i)) {
                    newIndices[type][i] = -1;
                } else {
                    newIndices[type][i] = newIndex;
                    newObjects[type][newIndex] = objectsOfType[i];
                    ++newIndex;
                }
            }
        }

        function remap(type: string, index: number): number {
            return -1 === index
                ? -1
                : newIndices[type][index];
        }

        // Remap indices in line objects
        for (let i = 0; i < newObjects.lines.length; ++i) {
            const line = newObjects.lines[i];

            newObjects.lines[i] = updateObject(line, {
                begin: remap('points', line.begin),
                end: remap('points', line.end),
                frontSide: remap('sides', line.frontSide),
                backSide: remap('sides', line.backSide),
                frontPoly: remap('polygons', line.frontPoly),
                backPoly: remap('polygons', line.backPoly),
            });
        }

        // Remap indices in side objects
        for (let i = 0; i < newObjects.sides.length; ++i) {
            const side = newObjects.sides[i];
            newObjects.sides[i] = updateObject(side, {
                polygonIndex: remap('polygons', side.polygonIndex),
                lineIndex: remap('lines', side.lineIndex),
                primaryLightsourceIndex: remap(
                    'lights', side.primaryLightsourceIndex),
                secondaryLightsourceIndex: remap(
                    'lights', side.secondaryLightsourceIndex),
                transparentLightsourceIndex: remap(
                    'lights', side.transparentLightsourceIndex),
            });
        }

        for (let i = 0; i < newObjects.polygons.length; ++i) {
            const polygon = newObjects.polygons[i];
            newObjects.polygons[i] = updateObject(polygon, {
                endpoints: polygon.endpoints.map((j: number) => remap('points', j)),
                lines: polygon.lines.map((j: number) => remap('lines', j)),
                sides: polygon.sides.map((j: number) => remap('sides', j)),
                floorLightsource: remap('lights', polygon.floorLightsource),
                ceilingLightsource: remap(
                    'lights', polygon.ceilingLightsource),
                adjacentPolygons: polygon.adjacentPolygons.map(
                    (j: number) => remap('polygons', j)),
            });
        }

        return new MapGeometry({
            index: this.index,
            header: this.header,
            info: this.info,
            ...newObjects,
        } as MapGeometryConstructor);
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
}
