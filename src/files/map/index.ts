import { Vec2, v2add, v2sub } from '../../vector2';
import { Side, SideTex } from './side';
import { Polygon } from './polygon';
import { Light, LightFlagBits } from './light';
import { MapObject } from './object';
import { Line, LineFlag } from './line';
import { ItemPlacement } from './item-placement';
import { Media } from './media';
import { AmbientSound } from './ambient-sound';
import { RandomSound } from './random-sound';
import { Note } from './note';
import { Platform } from './platform';
import { MapInfo } from './map-info';
import { TransferMode, WadHeader, SideType } from '../wad';
import { Dependencies } from './dependencies';
import { Remapping } from './index-remap';
import { polygonsAt } from '../../geometry';
import { FloorOrCeilingSurface, Surface, WallSurface } from '../../surface';
import { assertDefined, assertTrue, impossibleValue } from '../../utils';
import { SideCandidate } from './fillPolygon';
import { Vec3 } from '../../vector3';
import { LightFunctionType } from './light';
import { DependencyType } from './dependencies';

interface FloorCeilingRequest {
    polygonIndex: number,
    shape: number,
    offset: Vec2,
}

type TextureSlot = 'primary' | 'secondary' | 'transparent'

interface WallTextureRequest {
    polygonIndex: number,
    wallIndex: number,
    textureSlot: TextureSlot,
    shape: number,
    offset: Vec2,
    transferMode?: TransferMode
}

interface MapGeometryConstructor {
    index?: number;
    header?: WadHeader; // if we read this from existing file
    info?: MapInfo;
    points?: Vec2[];
    lights?: Light[];
    lines?: Line[];
    sides?: Side[];
    polygons?: Polygon[];
    media?: Media[];
    objects?: MapObject[];
    itemPlacement?: ItemPlacement[];
    ambientSounds?: AmbientSound[];
    randomSounds?: RandomSound[];
    notes?: Note[];
    platforms?: Platform[];
}

export type PolygonFilter = (polyIdx: number) => boolean

export interface SurfaceInfo {
    texCoords: Vec2;
    shape: number;
    transferMode: number;
    light: number;
}

function outOfRange(pt: Vec2): boolean {
    return pt[0] < -0x8000 || pt[0] > 0x7fff ||
        pt[1] < -0x8000 || pt[1] > 0x7fff;
}

const nDefaultLights = 10;
const nItemPlacements = 128;

function defaultLights(): Light[] {
    const lights: Light[] = [];

    for (let i = 0; i < nDefaultLights; ++i) {
        const maxI = nDefaultLights - 1;
        const brightness = (maxI - i) / maxI;
        lights.push(new Light({
            type: 0,
            tag: 0,
            flags: 1 << LightFlagBits.initiallyActive,
            phase: 0,
            states: [
                {
                    func: LightFunctionType.smooth,
                    period: 30,
                    intensity: 0xffff,
                    deltaIntensity: 0,
                    deltaPeriod: 0,
                },
                {
                    func: LightFunctionType.constant,
                    period: 30,
                    intensity: Math.floor(0xffff * brightness),
                    deltaIntensity: 0,
                    deltaPeriod: 0,
                },
                {
                    func: LightFunctionType.constant,
                    period: 0,
                    intensity: 0,
                    deltaIntensity: 0,
                    deltaPeriod: 0,
                },
                {
                    func: LightFunctionType.constant,
                    period: 30,
                    intensity: 0,
                    deltaIntensity: 0,
                    deltaPeriod: 0,
                },
                {
                    func: LightFunctionType.constant,
                    period: 30,
                    intensity: 0,
                    deltaIntensity: 0,
                    deltaPeriod: 0,
                },
                {
                    func: LightFunctionType.constant,
                    period: 30,
                    intensity: 0,
                    deltaIntensity: 0,
                    deltaPeriod: 0,
                },
            ],
        }));
    }
    return lights;
}

function defaultItemPlacements(): ItemPlacement[] {
    const placements: ItemPlacement[] = [];
    for (let i = 0; i < nItemPlacements; ++i) {
        placements.push(new ItemPlacement());
    }
    return placements;
}

export class MapGeometry {
    readonly index: number;
    readonly header?: WadHeader;
    readonly info: MapInfo;
    readonly points: Vec2[];
    readonly lights: Light[];
    readonly lines: Line[];
    readonly sides: Side[];
    readonly polygons: Polygon[];
    readonly media: Media[];
    readonly objects: MapObject[];
    readonly itemPlacement: ItemPlacement[];
    readonly ambientSounds: AmbientSound[];
    readonly randomSounds: RandomSound[];
    readonly notes: Note[];
    readonly platforms: Platform[];

    constructor(data: MapGeometryConstructor = {}) {
        this.index = data.index ?? 0;
        this.header = data.header;
        this.info = data.info ?? new MapInfo();
        this.points = data.points ?? [];
        this.lights = data.lights ?? defaultLights();
        this.lines = data.lines ?? [];
        this.sides = data.sides ?? [];
        this.polygons = data.polygons ?? [];
        this.media = data.media ?? [];
        this.objects = data.objects ?? [];
        this.itemPlacement = data.itemPlacement ?? defaultItemPlacements();
        this.ambientSounds = data.ambientSounds ?? [];
        this.randomSounds = data.randomSounds ?? [];
        this.notes = data.notes ?? [];
        this.platforms = data.platforms ?? [];
    }

    patch(changes: Partial<MapGeometryConstructor>): MapGeometry {
        return new MapGeometry({
            ...this,
            ...changes,
        });
    }

    movePoint(i: number, [x, y]: Vec2): MapGeometry {
        const newPoints = [...this.points];
        newPoints[i] = [Math.floor(x), Math.floor(y)];
        if (outOfRange(newPoints[i])) {
            return this;
        } else {
            return this.patch({ points: newPoints });
        }
    }

    neighboringPolygons(polygonIndex: number): number[] {
        const polygon = this.polygons[polygonIndex];
        if (!polygon) {
            throw new Error(`invalid polygon ${polygonIndex}`);
        }
        const neighbors = [];
        for (const lineIndex of polygon.lines) {
            if (lineIndex !== -1) {
                const line = this.lines[lineIndex];
                if (!line) {
                    throw new Error(`invalid line ${lineIndex}`);
                }
                if (line.frontPoly === polygonIndex && line.backPoly !== -1) {
                    neighbors.push(line.backPoly);
                } else if (line.backPoly === polygonIndex && line.frontPoly !== -1) {
                    neighbors.push(line.frontPoly);
                }
            }
        }
        return neighbors;
    }

    *floodBreadthFirst(startingPolyIndex: number, filter?: PolygonFilter): Generator<number> {
        const visitedIndexes = new Set<number>();
        const queue = [startingPolyIndex];
        while (queue.length !== 0) {
            const idx = queue.shift();
            if (typeof idx === 'number' &&
                !visitedIndexes.has(idx) &&
                (!filter || filter(idx))
            ) {
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
            return this.patch({ objects: newObjects });
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
        return this.patch({ ...this, points: newPoints });
    }

    getVerticalSurfaceInfo(surface: WallSurface): SurfaceInfo | null {
        const polygon = this.getPolygon(surface.polygonIndex);
        const sideIndex = polygon.sides[surface.wallIndex];

        if (sideIndex < 0 || sideIndex >= this.sides.length) {
            return null;
        }

        const side = this.getSide(sideIndex);

        let sideTex: SideTex;
        let transferMode: number;
        let lightIndex: number;

        switch (surface.type) {
            case 'wallPrimary':
                sideTex = side.primaryTexture;
                transferMode = side.primaryTransferMode;
                lightIndex = side.primaryLightsourceIndex;
                break;
            case 'wallSecondary':
                sideTex = side.secondaryTexture;
                transferMode = side.secondaryTransferMode;
                lightIndex = side.secondaryLightsourceIndex;
                break;
            case 'wallTransparent':
                sideTex = side.transparentTexture;
                transferMode = side.transparentTransferMode;
                lightIndex = side.transparentLightsourceIndex;
                break;
            default:
                impossibleValue(surface.type);
        }

        return {
            texCoords: sideTex.offset,
            shape: sideTex.texture,
            light: lightIndex,
            transferMode: transferMode
        };
    }

    getHorizontalSurfaceInfo(surface: FloorOrCeilingSurface): SurfaceInfo {
        const polygon = this.getPolygon(surface.polygonIndex);

        switch (surface.type) {
            case 'floor':
                return {
                    texCoords: polygon.floorOrigin,
                    shape: polygon.floorTexture,
                    light: polygon.floorLightsource,
                    transferMode: polygon.floorTransferMode
                };
            case 'ceiling':
                return {
                    texCoords: polygon.ceilingOrigin,
                    shape: polygon.ceilingTexture,
                    light: polygon.ceilingLightsource,
                    transferMode: polygon.ceilingTransferMode
                };
            default:
                impossibleValue(surface.type);
        }
    }

    getSurfaceInfo(surface: Surface): SurfaceInfo | null {
        switch (surface.type) {
            case 'wallPrimary':
            case 'wallSecondary':
            case 'wallTransparent':
                return this.getVerticalSurfaceInfo(surface);
            case 'floor':
            case 'ceiling':
                return this.getHorizontalSurfaceInfo(surface);
            default:
                impossibleValue(surface);
        }
    }

    getPolygon(polygonIndex: number): Polygon {
        if (polygonIndex < 0 || polygonIndex >= this.polygons.length) {
            throw new Error(`invalid polygon index: ${polygonIndex}`);
        }
        return this.polygons[polygonIndex];
    }

    getLine(lineIndex: number): Line {
        if (lineIndex < 0 || lineIndex >= this.lines.length) {
            throw new Error(`invalid line index: ${lineIndex}`);
        }
        return this.lines[lineIndex];
    }

    getSide(sideIndex: number): Side {
        if (sideIndex < 0 || sideIndex >= this.sides.length) {
            throw new Error(`invalid side index: ${sideIndex}`);
        }
        return this.sides[sideIndex];
    }

    getPolygonOnLineSide(lineIndex: number, isFront: boolean): number {
        const line = this.getLine(lineIndex);
        return isFront ? line.frontPoly : line.backPoly;
    }

    getSideFrontPolygon(sideIndex: number): Polygon {
        const side = this.getSide(sideIndex);
        return this.getPolygon(side.polygonIndex);
    }

    getSideBackPolygon(sideIndex: number): Polygon | undefined {
        const side = this.getSide(sideIndex);
        const line = this.getLine(side.lineIndex);
        const polyIndex = line.frontPoly === side.polygonIndex
            ? line.backPoly
            : line.frontPoly;
        if (polyIndex === side.polygonIndex) {
            throw new Error('Same polygon on both sides of line');
        } else if (polyIndex === -1) {
            return undefined;
        } else {
            return this.getPolygon(polyIndex);
        }
    }

    getPolygonSide(polygonIndex: number, wallIndex: number): Side {
        const polygon = this.getPolygon(polygonIndex);
        if (wallIndex < 0 || wallIndex >= polygon.vertexCount) {
            throw new Error(`invalid wall index: ${wallIndex}`);
        }
        return this.getSide(polygon.sides[wallIndex]);
    }

    getPolygonLine(polygonIndex: number, wallIndex: number): Line {
        const polygon = this.getPolygon(polygonIndex);
        if (wallIndex < 0 || wallIndex >= polygon.vertexCount) {
            throw new Error(`invalid wall index: ${wallIndex}`);
        }
        return this.getLine(polygon.lines[wallIndex]);
    }

    getPoint(pointIndex: number): Vec2 {
        if (pointIndex < 0 || pointIndex >= this.points.length) {
            throw new Error(`Invalid point index: ${pointIndex}`);
        }
        return this.points[pointIndex];
    }

    getPortal(polygonIndex: number, linePosition: number): number {
        const polygon = this.polygons[polygonIndex];
        const line = this.lines[polygon.lines[linePosition]];
        if (line.frontPoly === polygonIndex) {
            return line.backPoly;
        } else if (line.backPoly === polygonIndex) {
            return line.frontPoly;
        } else {
            throw new Error(`not front or back side poly=${polygonIndex} front=${line.frontPoly} back=${line.backPoly}`);
        }
    }

    wallSideType(polygonIndex: number, wallIndex: number): SideType {
        const polygon = this.polygons[polygonIndex];
        if (!polygon) {
            throw new Error(`polygon ${polygonIndex} not found`);
        }

        const neighborIndex = this.getPortal(polygonIndex, wallIndex);
        if (!neighborIndex || neighborIndex === -1) {
            return SideType.full;
        } else {
            const neighbor = this.polygons[neighborIndex];
            if (!neighbor) {
                throw new Error(`neighbor not found ${polygonIndex}`);
            }

            const portalTop = Math.min(polygon.ceilingHeight, neighbor.ceilingHeight);
            const portalBottom = Math.max(polygon.floorHeight, neighbor.floorHeight);
            const hasTop = portalTop !== polygon.ceilingHeight;
            const hasBottom = portalBottom !== polygon.floorHeight;

            let sideType = SideType.full;
            if (hasTop && hasBottom) {
                sideType = SideType.split;
            } else if (hasTop) {
                sideType = SideType.high;
            } else if (hasBottom) {
                sideType = SideType.low;
            }

            return sideType;
        }
    }

    setVerticalSurfaceTextureInfo(
        surface: WallSurface, surfaceInfo: SurfaceInfo
    ): MapGeometry {
        const polygon = this.getPolygon(surface.polygonIndex);
        const side = this.getPolygonSide(surface.polygonIndex, surface.wallIndex);
        const sideIndex = polygon.sides[surface.wallIndex];
        const newSides = [...this.sides];

        switch (surface.type) {
            case 'wallPrimary':
                newSides[sideIndex] = new Side({
                    ...side,
                    primaryTexture: new SideTex({
                        offset: surfaceInfo.texCoords,
                        texture: surfaceInfo.shape,
                    }),
                    primaryLightsourceIndex: surfaceInfo.light,
                    primaryTransferMode: surfaceInfo.transferMode,
                });
                break;
            case 'wallSecondary':
                newSides[sideIndex] = new Side({
                    ...side,
                    secondaryTexture: new SideTex({
                        offset: surfaceInfo.texCoords,
                        texture: surfaceInfo.shape,
                    }),
                    secondaryLightsourceIndex: surfaceInfo.light,
                    secondaryTransferMode: surfaceInfo.transferMode,
                });
                break;
            case 'wallTransparent':
                newSides[sideIndex] = new Side({
                    ...side,
                    transparentTexture: new SideTex({
                        offset: surfaceInfo.texCoords,
                        texture: surfaceInfo.shape,
                    }),
                    transparentLightsourceIndex: surfaceInfo.light,
                    transparentTransferMode: surfaceInfo.transferMode,
                });
                break;
            default:
                impossibleValue(surface.type);
        }

        return this.patch({ sides: newSides });
    }

    setHorizontalSurfaceTextureInfo(
        surface: FloorOrCeilingSurface, surfaceInfo: SurfaceInfo
    ): MapGeometry {
        const polygon = this.getPolygon(surface.polygonIndex);
        const newPolygons = [...this.polygons];
        switch (surface.type) {
            case 'floor':
                newPolygons[surface.polygonIndex] = new Polygon({
                    ...polygon,
                    floorOrigin: surfaceInfo.texCoords,
                    floorTexture: surfaceInfo.shape,
                    floorLightsource: surfaceInfo.light,
                    floorTransferMode: surfaceInfo.transferMode
                });
                break;
            case 'ceiling':
                newPolygons[surface.polygonIndex] = new Polygon({
                    ...polygon,
                    ceilingOrigin: surfaceInfo.texCoords,
                    ceilingTexture: surfaceInfo.shape,
                    ceilingLightsource: surfaceInfo.light,
                    ceilingTransferMode: surfaceInfo.transferMode
                });
                break;
            default:
                impossibleValue(surface.type);
        }
        return this.patch({ polygons: newPolygons });
    }

    setSurfaceTextureInfo(surface: Surface, surfaceInfo: SurfaceInfo): MapGeometry {
        switch (surface.type) {
            case 'wallPrimary':
            case 'wallSecondary':
            case 'wallTransparent':
                return this.setVerticalSurfaceTextureInfo(surface, surfaceInfo);
            case 'floor':
            case 'ceiling':
                return this.setHorizontalSurfaceTextureInfo(surface, surfaceInfo);
            default:
                impossibleValue(surface);
        }
    }

    setWallTexture({
        polygonIndex,
        wallIndex,
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
                type: this.wallSideType(polygonIndex, wallIndex),
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

            return this.patch({ sides, polygons });
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
            return this.patch({ sides });
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
        return this.patch({ polygons });
    }

    setCeilingTexture({ polygonIndex, shape, offset }: FloorCeilingRequest): MapGeometry {
        const polygons = [...this.polygons];
        polygons[polygonIndex] = new Polygon({
            ...polygons[polygonIndex],
            ceilingTexture: shape,
            ceilingOrigin: offset,
            ceilingTransferMode: TransferMode.normal,
        });
        return this.patch({ polygons });
    }

    removeObjectsAndRenumber(deadObjects: Dependencies): MapGeometry {
        const polygonsDeleted =
            deadObjects.objects.get(DependencyType.polygon) ?? [];
        const linesAffected = polygonsDeleted.flatMap(poly =>
            this.getPolygon(poly).lines);
        const mappings = new Remapping(this, deadObjects);
        const newArrays = mappings.remap();
        const withObjectsRemoved = new MapGeometry({
            index: this.index,
            header: this.header,
            info: this.info,
            ...newArrays,
        });
        return withObjectsRemoved.resetLineSides(linesAffected, true);
    }

    deletePolygon(polygonIdx: number): MapGeometry {
        const deletions = new Dependencies();
        deletions.addPolygon(this, polygonIdx);
        return this.removeObjectsAndRenumber(deletions);
    }

    deleteLine(lineIndex: number): MapGeometry {
        const deletions = new Dependencies();
        deletions.addLine(this, lineIndex);
        return this.removeObjectsAndRenumber(deletions);
    }

    deleteSide(sideIdx: number): MapGeometry {
        const deletions = new Dependencies();
        deletions.addSide(this, sideIdx);
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

    updateObject(objectIdx: number, newObject: MapObject): MapGeometry {
        if (objectIdx < 0 || objectIdx >= this.objects.length) {
            throw new Error(`Invalid object index ${objectIdx}`);
        }
        const newObjects = [...this.objects];
        newObjects[objectIdx] = newObject;
        return this.patch({ objects: newObjects });
    }

    removePrecalculatedInfo(): MapGeometry {
        return this.patch({
            polygons: this.polygons.map(p => new Polygon({
                ...p,
                firstObject: -1,
                firstNeighbor: -1,
                nNeighbors: -1,
                firstExclusionZone: -1,
                nPointExclusionZones: -1,
                nLineExclusionZones: -1,
                firstSoundSource: -1,
            })),
        });
    }

    addPoint(v: Vec2): [MapGeometry, number] {
        const pointIndex = this.points.length;
        const newPoints = [...this.points];
        newPoints[pointIndex] = v;
        return [
            this.patch({
                points: newPoints,
            }),
            pointIndex
        ];
    }

    addLine(startPointIndex: number, endPointIndex: number): [MapGeometry, number] {
        const lineIndex = this.lines.length;
        const newLines = [...this.lines];
        newLines[lineIndex] = new Line({
            begin: startPointIndex,
            end: endPointIndex,
            flags: 0,
            length: 0,
            highestFloor: 0,
            lowestCeiling: 0,
            frontSide: -1,
            backSide: -1,
            frontPoly: -1,
            backPoly: -1,
        });
        return [
            this.patch({
                lines: newLines,
            }),
            lineIndex
        ];
    }

    addPolygon(sides: SideCandidate[]): MapGeometry {
        if (sides.length < 3 || sides.length > 8) {
            throw new Error(`Invalid polygon size: ${sides.length}`);
        }

        const newLines = [...this.lines];
        const newSides = [...this.sides];
        const newPolygons = [...this.polygons];
        const newPolygonIndex = newPolygons.length;
        const newFloorHeight = 0;
        const newCeilingHeight = 1024;

        const polygonSides = sides.map((side) => {
            const otherPolygonIndex = this.getPolygonOnLineSide(side.lineIndex, !side.isFront);
            let sideType: SideType;

            if (otherPolygonIndex === -1) {
                sideType = SideType.full;
            } else {
                const otherPolygon = this.getPolygon(otherPolygonIndex);

                if (otherPolygon.floorHeight > newFloorHeight &&
                    otherPolygon.ceilingHeight < newCeilingHeight) {
                    sideType = SideType.split;
                } else if (otherPolygon.ceilingHeight < newCeilingHeight) {
                    sideType = SideType.high;
                } else if (otherPolygon.floorHeight > newFloorHeight) {
                    sideType = SideType.low;
                } else {
                    // no side needed
                    return -1;
                }
            }

            const newSideIndex = newSides.length;
            newSides.push(new Side({
                type: sideType,
                polygonIndex: newPolygonIndex,
                lineIndex: side.lineIndex,
            }));

            return newSideIndex;
        });

        sides.forEach((newSide, polygonSideIdx) => {
            const newSideIdx = polygonSides[polygonSideIdx];
            if (-1 !== this.getPolygonOnLineSide(newSide.lineIndex, newSide.isFront)) {
                throw new Error('Polygon already exists on this side');
            }
            const line = newLines[newSide.lineIndex];
            const modifiedLine = new Line({
                ...line,
                frontPoly: newSide.isFront ? newPolygonIndex : line.frontPoly,
                backPoly: !newSide.isFront ? newPolygonIndex : line.backPoly,
                frontSide: newSide.isFront ? newSideIdx : line.frontSide,
                backSide: !newSide.isFront ? newSideIdx : line.backSide,
            });
            newLines[newSide.lineIndex] = modifiedLine;
        });

        const newPoly = new Polygon({
            endpoints: sides.map((side) => {
                const line = this.getLine(side.lineIndex);
                return side.isFront ? line.begin : line.end;
            }),
            lines: sides.map((side) => side.lineIndex),
            floorHeight: newFloorHeight,
            ceilingHeight: newCeilingHeight,
            sides: polygonSides,
        });
        newPolygons.push(newPoly);

        const withNewPoly = this.patch({
            lines: newLines,
            sides: newSides,
            polygons: newPolygons,
        });

        return withNewPoly.resetLineSides(newPoly.lines, true);
    }

    // Unique list of floor heighs, sorted ascending
    getFloorHeights(): number[] {
        const heights = new Set<number>(this.polygons.map(p => p.floorHeight));
        return [...heights].sort((a, b) => a - b);
    }

    // Unique list of ceiling heighs, sorted ascending
    getCeilingHeights(): number[] {
        const heights = new Set<number>(this.polygons.map(p => p.ceilingHeight));
        return [...heights].sort((a, b) => a - b);
    }

    setFloorHeight(polygonIndex: number, height: number): MapGeometry {
        const polygons = [...this.polygons];
        const oldPolygon = this.getPolygon(polygonIndex);
        polygons[polygonIndex] = new Polygon({
            ...oldPolygon,
            floorHeight: height
        });
        return this.patch({ polygons }).resetLineSides(
            oldPolygon.lines, false);
    }

    setCeilingHeight(polygonIndex: number, height: number): MapGeometry {
        const polygons = [...this.polygons];
        const oldPolygon = this.getPolygon(polygonIndex);
        polygons[polygonIndex] = new Polygon({
            ...oldPolygon,
            ceilingHeight: height
        });
        return this.patch({ polygons }).resetLineSides(
            oldPolygon.lines, false);
    }

    changeHeight(
        heightType: 'floorHeight' | 'ceilingHeight',
        oldHeight: number,
        newHeight: number
    ): MapGeometry {
        return this.patch({
            polygons: this.polygons.map((oldPoly) => {
                if (oldPoly[heightType] === oldHeight) {
                    return new Polygon({
                        ...oldPoly,
                        [heightType]: newHeight
                    });
                } else {
                    return oldPoly;
                }
            })
        });
    }

    addObject(polygonIndex: number, position: Vec3): MapGeometry {
        return this.patch({
            objects: [
                ...this.objects,
                new MapObject({
                    position,
                    polygon: polygonIndex,
                })
            ]
        });
    }

    addSide(side: Side): MapGeometry {
        const sides = [...this.sides];
        sides.push(side);
        return this.patch({ sides });
    }

    setLine(lineIndex: number, line: Line): MapGeometry {
        const lines = [...this.lines];
        lines[lineIndex] = line;
        return this.patch({ lines });
    }

    setSide(sideIndex: number, side: Side): MapGeometry {
        const sides = [...this.sides];
        sides[sideIndex] = side;
        return this.patch({ sides });
    }

    setPolygon(polygonIndex: number, polygon: Polygon): MapGeometry {
        const polygons = [...this.polygons];
        polygons[polygonIndex] = polygon;
        return this.patch({ polygons });
    }

    // Set side type & line flags flags based on polygon connectivity and
    // heights. Should be used for the lines of a polygon when adding or
    // deleting a polygon, or when changing polygon heights
    resetLineSides(
        lineIndexes: Iterable<number>,
        inferTransparentSides: boolean,
    ): MapGeometry {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let map: MapGeometry = this;

        for (const lineIndex of lineIndexes) {
            map = map.resetLineSide(lineIndex, 'front', inferTransparentSides);
            map = map.resetLineSide(lineIndex, 'back', inferTransparentSides);
        }

        return map;
    }

    private resetLineSide(
        lineIndex: number,
        thisSide: 'front' | 'back',
        inferTransparentSides: boolean,
    ): MapGeometry {
        const otherSide =
            thisSide === 'front' ? 'back' : 'front';
        let line = this.getLine(lineIndex);

        const thisSidePolyIndex = line[`${thisSide}Poly`];
        const otherSidePolyIndex = line[`${otherSide}Poly`];
        const thisSideIndex = line[`${thisSide}Side`];

        let correctSideType: SideType | undefined;
        let joinsTwoPolygons = false;

        if (thisSidePolyIndex !== -1 && otherSidePolyIndex !== -1) {
            // polygon on both sides
            joinsTwoPolygons = true;
            const thisSidePoly = this.getPolygon(thisSidePolyIndex);
            const otherSidePoly = this.getPolygon(otherSidePolyIndex);

            if (thisSidePoly.floorHeight < otherSidePoly.floorHeight) {
                if (thisSidePoly.ceilingHeight > otherSidePoly.ceilingHeight) {
                    correctSideType = SideType.split;
                } else {
                    correctSideType = SideType.low;
                }
            } else if (thisSidePoly.ceilingHeight > otherSidePoly.ceilingHeight) {
                correctSideType = SideType.high;
            }
        } else if (thisSidePolyIndex !== -1) {
            // only polygon on this side
            correctSideType = SideType.full;
        }

        const currentSideType: SideType | undefined = thisSideIndex !== -1
            ? this.getSide(thisSideIndex).type
            : undefined;

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let map: MapGeometry = this;

        if (!joinsTwoPolygons) {
            line = line.patchFlag(LineFlag.solid, true);
            line = line.patchFlag(LineFlag.transparent, false);
        } else if (inferTransparentSides) {
            line = line.patchFlag(LineFlag.solid, false);
            line = line.patchFlag(LineFlag.transparent, true);
        }

        line = line.patchFlag(
            LineFlag.elevation,
            typeof correctSideType === 'number');

        if (currentSideType !== correctSideType) {
            if (currentSideType === undefined &&
                correctSideType !== undefined) {
                // need to create side
                map = map.addSide(new Side({
                    polygonIndex: thisSidePolyIndex,
                    lineIndex: lineIndex,
                    type: correctSideType
                }));

                const newSideIndex = map.sides.length - 1;
                line = line.patch({
                    [`${thisSide}Side`]: newSideIndex,
                });

                const thisSidePoly = map.getPolygon(thisSidePolyIndex);
                const lineIdxOnPoly = thisSidePoly.lines.indexOf(lineIndex);
                assertTrue(lineIdxOnPoly >= 0, 'line not found on polygon');

                const polySides = [...thisSidePoly.sides];
                polySides[lineIdxOnPoly] = newSideIndex;

                map = map.setPolygon(thisSidePolyIndex, thisSidePoly.patch({
                    sides: polySides
                }));
            } else if (currentSideType !== undefined &&
                correctSideType === undefined) {
                // need to delete side

                map = map.deleteSide(thisSideIndex);
                line = line.patch({
                    [`${thisSide}Side`]: -1
                });
            } else {
                // need to change side type
                map = map.setSide(
                    thisSideIndex,
                    map.getSide(thisSideIndex).patch({
                        type: correctSideType
                    })
                );
            }
        }

        map = map.setLine(lineIndex, line);

        return map;
    }

    consistencyErrors(): string[] {
        const errors: string[] = [];

        const indexInvalid = (array: unknown[], index: number): boolean => {
            return index !== -1 && (index < 0 || index >= array.length);
        };

        const makeChecker = (
            referrerType: string,
            referrerIndex: number
        ) => (
            referenceName: string,
            referenceIndex: number,
            referredArray: unknown[],
        ): void => {
                if (indexInvalid(referredArray, referenceIndex)) {
                    errors.push(`${referrerType} ${referrerIndex} has an invalid ${referenceName} ${referenceIndex}`);
                }
            };

        this.polygons.forEach((polygon, polygonIndex) => {
            const check = makeChecker('polygon', polygonIndex);

            for (const adjacentIndex of polygon.adjacentPolygons) {
                check('adjacent polygon', adjacentIndex, this.polygons);
            }

            check('ambient sound', polygon.ambientSound, this.ambientSounds);
            check('ceiling light', polygon.ceilingLightsource, this.lights);
            check('floor light', polygon.floorLightsource, this.lights);
            check('media light', polygon.mediaLightsource, this.lights);

            for (const endpointIdx of polygon.endpoints) {
                check('endpoint', endpointIdx, this.points);
            }

            for (const lineIdx of polygon.lines) {
                check('line', lineIdx, this.lines);
            }

            for (const sideIdx of polygon.sides) {
                check('side', sideIdx, this.sides);
            }

            check('media', polygon.media, this.media);

            check('random sound', polygon.randomSound, this.randomSounds);

            polygon.sides.forEach((sideIdx, polyEdgeIdx) => {
                const line = this.getLine(polygon.lines[polyEdgeIdx]);
                if (sideIdx !== line.backSide && sideIdx !== line.frontSide) {
                    errors.push(`polygon side ${polyEdgeIdx} does not match line side`);
                }

                if (polygonIndex !== line.frontPoly && polygonIndex !== line.backPoly) {
                    errors.push(`polygon ${polygonIndex} contains line that doesn't reference it`);
                }
            });
        });

        this.sides.forEach((side, sideIdx) => {
            const check = makeChecker('side', sideIdx);
            check('line', side.lineIndex, this.lines);
            check('polygon', side.polygonIndex, this.lines);
            check('primary light', side.primaryLightsourceIndex, this.lights);
            check('secondary light', side.secondaryLightsourceIndex, this.lights);
            check(
                'transparent light',
                side.transparentLightsourceIndex,
                this.lights);

            const line = this.getLine(side.lineIndex);

            if (line.frontSide !== sideIdx && line.backSide !== sideIdx) {
                errors.push(`side ${sideIdx} part of line ${side.lineIndex} that does not reference it`);
            }
        });

        this.lines.forEach((line, lineIdx) => {
            const check = makeChecker('line', lineIdx);
            check('back polygon', line.backPoly, this.polygons);
            check('front polygon', line.frontPoly, this.polygons);
            check('back side', line.backSide, this.sides);
            check('front side', line.frontSide, this.sides);

            if (line.frontSide !== -1) {
                const frontSide = this.getSide(line.frontSide);
                if (frontSide.lineIndex !== lineIdx) {
                    errors.push(`line ${lineIdx} references side ${line.frontSide} on other line`);
                }
            }

            if (line.backSide !== -1) {
                const backSide = this.getSide(line.backSide);
                if (backSide.lineIndex !== lineIdx) {
                    errors.push(`line ${lineIdx} references side ${line.backSide} on other line`);
                }
            }
        });

        this.media.forEach((media, mediaIdx) => {
            const check = makeChecker('media', mediaIdx);
            check('light', media.lightIndex, this.lights);
        });

        this.notes.forEach((note, noteIdx) => {
            const check = makeChecker('note', noteIdx);
            check('polygon', note.polygonIndex, this.polygons);
        });

        this.platforms.forEach((platform, platformIdx) => {
            const check = makeChecker('platform', platformIdx);
            check('polygon', platform.polygonIndex, this.polygons);
        });

        this.objects.forEach((object, objectIdx) => {
            const check = makeChecker('object', objectIdx);
            check('polygon', object.polygon, this.polygons);
        });

        return errors;
    }
}
