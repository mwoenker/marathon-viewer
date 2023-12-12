import type { MapGeometry } from '.';

// Holds sets of object indices

export enum DependencyType {
    point,
    line,
    side,
    polygon,
    object,
    note,
    light,
    itemPlacement,
    media,
    ambientSound,
    randomSound,
    platform,
}

export const dependencyTypes: DependencyType[] = Object.values(DependencyType)
    .filter((v): v is DependencyType => typeof v === 'number');

export class Dependencies {
    objects: Map<DependencyType, number[]>

    constructor() {
        this.objects = new Map();
    }

    // Add object, but not its dependent objects. Returns true if object is already
    // in list.
    _add(type: DependencyType, index: number): boolean {
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

    objectsOfType(type: DependencyType): number[] {
        return this.objects.get(type) || [];
    }

    includes(type: DependencyType, index: number): boolean {
        return this.objectsOfType(type).includes(index);
    }

    // Functions to add an object, plus recursively all objects that depend on
    // it. An object B is dependent on object A if B must be deleted when A is
    // deleted -- i.e. a line is dependent on its two endpoints because when one
    // of its endpoints is deleted, the line can no longer exist.

    addPoint(map: MapGeometry, pointIndex: number): void {
        if (this._add(DependencyType.point, pointIndex)) {
            for (let i = 0; i < map.lines.length; ++i) {
                const line = map.lines[i];
                if (pointIndex === line.begin || pointIndex === line.end) {
                    this.addLine(map, i);
                }
            }
        }
    }
    addLine(map: MapGeometry, lineIndex: number): void {
        if (this._add(DependencyType.line, lineIndex)) {
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
        this._add(DependencyType.side, sideIndex);
    }
    addPolygon(map: MapGeometry, polygonIndex: number): void {
        if (this._add(DependencyType.polygon, polygonIndex)) {
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
            for (let i = 0; i < map.platforms.length; ++i) {
                if (map.platforms[i].polygonIndex === polygonIndex) {
                    this.addPlatform(map, i);
                }
            }
        }
    }
    addObject(map: MapGeometry, objectIndex: number): void {
        this._add(DependencyType.object, objectIndex);
    }
    addNote(map: MapGeometry, noteIndex: number): void {
        this._add(DependencyType.note, noteIndex);
    }
    addLight(map: MapGeometry, lightIndex: number): void {
        this._add(DependencyType.light, lightIndex);
    }
    addItemPlacement(map: MapGeometry, index: number): void {
        this._add(DependencyType.itemPlacement, index);
    }
    addMedia(map: MapGeometry, index: number): void {
        this._add(DependencyType.media, index);
    }
    addAmbientSound(map: MapGeometry, index: number): void {
        this._add(DependencyType.ambientSound, index);
    }
    addRandomSound(map: MapGeometry, index: number): void {
        this._add(DependencyType.randomSound, index);
    }
    addPlatform(map: MapGeometry, index: number): void {
        this._add(DependencyType.platform, index);
    }
}
