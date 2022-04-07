import { Dependencies, DependencyType } from "./dependencies";
import { Vec2 } from '../../vector2';
import { Side } from './side';
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

// return new object with updates merged into original. If updates don't
// actually change any values of the original, return the original unchanged
function updateObject<T>(original: T, updates: Partial<T>): T {
    function compare(a: unknown, b: unknown): boolean {
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

export function remappedIndexes<T>(objectType: DependencyType, objects: T[], deletedObjects: Dependencies): number[] {
    let newIndex = 0;
    return objects.map((obj, oldIndex) => {
        return deletedObjects.includes(objectType, oldIndex) ? -1 : newIndex++;
    });
}

export function buildNewArray<T>(oldObjects: T[], indexMapping: number[]): T[] {
    if (oldObjects.length !== indexMapping.length) {
        throw new Error('objects and index mapping do not have the same length');
    }
    const newSize = indexMapping.reduce((maxSoFar, idx) => {
        return Math.max(maxSoFar, idx);
    }, 0);
    const entries = new Array(newSize);
    indexMapping.forEach((newIndex, oldIndex) => {
        entries[newIndex] = oldObjects[oldIndex];
    });
    return entries;
}

export function getNewIndex(oldIndex: number, mapping: number[]): number {
    if (oldIndex < 0 || oldIndex >= mapping.length) {
        return -1;
    } else {
        return mapping[oldIndex];
    }
}

interface MappingSource {
    points: Vec2[]
    lines: Line[]
    sides: Side[]
    polygons: Polygon[]
    objects: MapObject[]
    notes: Note[],
    lights: Light[]
    itemPlacement: ItemPlacement[]
    media: Media[]
    ambientSounds: AmbientSound[]
    randomSounds: RandomSound[]
    platforms: Platform[]
}

// Tracks the mapping from old indexes -> new indexes after the objects in
// deletedObjects have been removed. 
export class Remapping {
    source: MappingSource
    points: number[]
    lines: number[]
    sides: number[]
    polygons: number[]
    objects: number[]
    notes: number[]
    lights: number[]
    itemPlacements: number[]
    media: number[]
    ambientSounds: number[]
    randomSounds: number[]
    platforms: number[]

    constructor(source: MappingSource, deletedObjects: Dependencies) {
        this.source = source;
        this.points = remappedIndexes(DependencyType.point, source.points, deletedObjects);
        this.lines = remappedIndexes(DependencyType.line, source.lines, deletedObjects);
        this.sides = remappedIndexes(DependencyType.side, source.sides, deletedObjects);
        this.polygons = remappedIndexes(DependencyType.polygon, source.polygons, deletedObjects);
        this.objects = remappedIndexes(DependencyType.object, source.objects, deletedObjects);
        this.notes = remappedIndexes(DependencyType.note, source.notes, deletedObjects);
        this.lights = remappedIndexes(DependencyType.light, source.lights, deletedObjects);
        this.itemPlacements = remappedIndexes(DependencyType.itemPlacement, source.itemPlacement, deletedObjects);
        this.media = remappedIndexes(DependencyType.media, source.media, deletedObjects);
        this.ambientSounds = remappedIndexes(DependencyType.ambientSound, source.ambientSounds, deletedObjects);
        this.randomSounds = remappedIndexes(DependencyType.randomSound, source.randomSounds, deletedObjects);
        this.platforms = remappedIndexes(DependencyType.platform, source.platforms, deletedObjects);
    }

    // Return new arrays with the deleted objects no longer present
    private withoutDeleted(): MappingSource {
        return {
            points: buildNewArray(this.source.points, this.points),
            lines: buildNewArray(this.source.lines, this.lines),
            sides: buildNewArray(this.source.sides, this.sides),
            polygons: buildNewArray(this.source.polygons, this.polygons),
            objects: buildNewArray(this.source.objects, this.objects),
            notes: buildNewArray(this.source.notes, this.notes),
            lights: buildNewArray(this.source.lights, this.lights),
            itemPlacement: buildNewArray(this.source.itemPlacement, this.itemPlacements),
            media: buildNewArray(this.source.media, this.media),
            ambientSounds: buildNewArray(this.source.ambientSounds, this.ambientSounds),
            randomSounds: buildNewArray(this.source.randomSounds, this.randomSounds),
            platforms: buildNewArray(this.source.platforms, this.platforms),
        };
    }

    // Produce new object lists with the deleted objects removed and references
    // in the objects rewritten to reference the new indexes
    remap(): MappingSource {
        const newArrays = this.withoutDeleted();
        return {
            ...newArrays,
            lines: newArrays.lines.map(line => updateObject(line, {
                begin: getNewIndex(line.begin, this.points),
                end: getNewIndex(line.end, this.points),
                frontSide: getNewIndex(line.frontSide, this.sides),
                backSide: getNewIndex(line.backSide, this.sides),
                frontPoly: getNewIndex(line.frontPoly, this.polygons),
                backPoly: getNewIndex(line.backPoly, this.polygons),
            })),
            sides: newArrays.sides.map(side => updateObject(side, {
                polygonIndex: getNewIndex(side.polygonIndex, this.polygons),
                lineIndex: getNewIndex(side.lineIndex, this.lines),
                primaryLightsourceIndex: getNewIndex(
                    side.primaryLightsourceIndex, this.lights),
                secondaryLightsourceIndex: getNewIndex(
                    side.secondaryLightsourceIndex, this.lights),
                transparentLightsourceIndex: getNewIndex(
                    side.transparentLightsourceIndex, this.lights),
            })),
            polygons: newArrays.polygons.map(polygon => updateObject(polygon, {
                endpoints: polygon.endpoints.map((j: number) => getNewIndex(j, this.points)),
                lines: polygon.lines.map((j: number) => getNewIndex(j, this.lines)),
                sides: polygon.sides.map((j: number) => getNewIndex(j, this.sides)),
                floorLightsource: getNewIndex(polygon.floorLightsource, this.lights),
                ceilingLightsource: getNewIndex(
                    polygon.ceilingLightsource, this.lights),
                adjacentPolygons: polygon.adjacentPolygons.map(
                    (j: number) => getNewIndex(j, this.polygons)),
            })),
            objects: newArrays.objects.map(obj => updateObject(obj, {
                polygon: getNewIndex(obj.polygon, this.polygons)
            })),
            platforms: newArrays.platforms.map(platform => updateObject(platform, {
                polygonIndex: getNewIndex(platform.polygonIndex, this.polygons)
            })),
        };
    }
}

