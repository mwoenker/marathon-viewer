import { Collision2d, closerCollision, collideLineSegments, lineSegmentIntersectsHorizontalPolygon } from './collision';
import { lerp, floorMod } from './utils';
import { v2scale, Vec2 } from './vector2';
import { Vec3 } from './vector3';
import { Line } from './files/map/line';
import { Side, SideTex } from './files/map/side';
import { Polygon } from './files/map/polygon';
import { MapObject } from './files/map/object';
import { Media } from './files/map/media';
import { mediaDefinitions, sideType } from './files/wad';
import { MapGeometry } from './files/map';
import { makeShapeDescriptor } from './files/shapes';
import { LightState } from './light';

export const worldUnitSize = 1024;
export const ticksPerSecond = 30;
const numFixedAngles = 512;

export function toFixedAngle(radians: number): number {
    return floorMod(Math.floor(radians * numFixedAngles / Math.PI / 2), numFixedAngles);
}

export function fromFixedAngle(fixedAngle: number): number {
    return fixedAngle / numFixedAngles * Math.PI * 2;
}

export function toMapCoords2d(p: Vec2): Vec2 {
    return [
        0xffff & (p[0] * worldUnitSize),
        0xffff & (p[1] * worldUnitSize),
    ];
}

export function toMapCoords3d(p: Vec3): Vec3 {
    return [
        0xffff & (p[0] * worldUnitSize),
        0xffff & (p[1] * worldUnitSize),
        0xffff & (p[2] * worldUnitSize),
    ];
}

export function fromMapCoords2d(p: Vec2): Vec2 {
    return [
        p[0] / worldUnitSize,
        p[1] / worldUnitSize,
    ];
}

export function fromMapCoords3d(p: Vec3): Vec3 {
    return [
        p[0] / worldUnitSize,
        p[1] / worldUnitSize,
        p[2] / worldUnitSize,
    ];
}

interface HorizontalSurfaceInfo {
    height: number;
    textureOffset: Vec2;
    texture: number;
    transferMode: number;
    lightIntensity: number;
}

interface FloorCeilingInfo {
    floor: HorizontalSurfaceInfo;
    ceiling: HorizontalSurfaceInfo;
}

interface RayCollisionFloorCeiling {
    type: 'floor' | 'ceiling';
    polygonIndex: number;
}

interface RayCollisionWall {
    type: 'wallPrimary' | 'wallSecondary';
    polygonIndex: number;
    wallIndex: number;
    sideType: sideType;
}

type RayCollision = RayCollisionFloorCeiling | RayCollisionWall

export class World {
    map: MapGeometry;
    points: Vec2[];
    lines: Line[];
    sides: Side[];
    polygons: Polygon[];
    // lights: Light[];
    objects: MapObject[];
    media: Media[];
    lightState: LightState[];
    timeElapsed: number;

    constructor(map: MapGeometry) {
        this.updateMap(map);
        this.lightState = map.lights.map(light => new LightState(light));
        this.timeElapsed = 0;
    }

    advanceTimeSlice(slice: number): void {
        const prevTicks = Math.floor(this.timeElapsed * 30);
        this.timeElapsed += slice;
        const nextTicks = Math.floor(this.timeElapsed * 30);
        this.lightState.forEach(state => state.advanceTicks(nextTicks - prevTicks));
    }

    updateMap(map: MapGeometry): void {
        this.map = map;
        this.points = map.points.map(([x, y]) => [x / worldUnitSize, y / worldUnitSize]);
        this.lines = map.lines;
        this.sides = map.sides;
        this.polygons = map.polygons.map((p: Polygon) => new Polygon({
            ...p,
            floorHeight: p.floorHeight / worldUnitSize,
            ceilingHeight: p.ceilingHeight / worldUnitSize,
        }));
        // this.lights = map.lights;
        this.objects = map.objects;
        this.media = map.media;
    }

    getPolygon(polygonIndex: number): Polygon {
        if (polygonIndex < 0 || polygonIndex >= this.polygons.length) {
            throw new Error(`invalid polygon index: ${polygonIndex}`);
        }
        return this.polygons[polygonIndex];
    }

    getSide(sideIndex: number): Side {
        if (sideIndex < 0 || sideIndex >= this.sides.length) {
            throw new Error(`invalid side index: ${sideIndex}`);
        }
        return this.sides[sideIndex];
    }

    getPoint(pointIndex: number): Vec2 {
        if (pointIndex < 0 || pointIndex >= this.points.length) {
            throw new Error(`invalid point index: ${pointIndex}`);
        }
        return this.points[pointIndex];
    }

    getLineVertices(polygonIndex: number, linePosition: number): [Vec2, Vec2] {
        const polygon = this.polygons[polygonIndex];
        return [
            this.points[polygon.endpoints[linePosition]],
            this.points[polygon.endpoints[(linePosition + 1) % polygon.endpoints.length]]
        ];
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

    getTexOffset(sideTexDef: SideTex): Vec2 {
        if (!sideTexDef) {
            return [0, 0];
        }
        return [
            floorMod(sideTexDef.offset[0], worldUnitSize) / worldUnitSize,
            floorMod(sideTexDef.offset[1], worldUnitSize) / worldUnitSize,
        ];
    }

    getLightIntensity(lightIndex: number): number {
        const intensity = this.lightState[lightIndex].intensity / 0x10000;
        if (intensity !== 0 && !intensity) {
            console.log(lightIndex, this.lightState);
            throw new Error('blam2');
        }
        return intensity;
    }

    getPolygonPoints(polygonIndex: number): Vec2[] {
        const polygon = this.polygons[polygonIndex];
        return polygon.endpoints.map(index => this.points[index]);
    }

    getFloorOffset(polygonIndex: number): Vec2 {
        const polygon = this.polygons[polygonIndex];
        return [
            polygon.floorOrigin[0] / worldUnitSize,
            polygon.floorOrigin[1] / worldUnitSize,
        ];
    }

    getCeilingOffset(polygonIndex: number): Vec2 {
        const polygon = this.polygons[polygonIndex];
        return [
            polygon.ceilingOrigin[0] / worldUnitSize,
            polygon.ceilingOrigin[1] / worldUnitSize,
        ];
    }

    getMediaInfo(polygonIndex: number): HorizontalSurfaceInfo | null {
        const polygon = this.polygons[polygonIndex];
        const mediaIndex = polygon.media;

        if (mediaIndex === -1 || !(mediaIndex in this.media)) {
            return null;
        }
        const media = this.media[mediaIndex];
        const lightLevel = this.getLightIntensity(media.lightIndex);
        // const lightLevel = 0.5 + Math.sin(seconds / 4) / 2;
        const height = lerp(lightLevel, media.low, media.high) / worldUnitSize;

        const def = mediaDefinitions[media.type];

        return {
            height,
            textureOffset: v2scale(1 / worldUnitSize, media.originAtTime(this.timeElapsed)), // media.origin,
            texture: makeShapeDescriptor(0, def.collection, def.shape),
            transferMode: media.transferMode,
            lightIntensity: this.getLightIntensity(polygon.mediaLightsource),
        };
    }

    getPolygonFloorCeiling(
        polygonIndex: number,
        playerHeight: number,
        isSubmerged: boolean): FloorCeilingInfo {
        const polygon = this.polygons[polygonIndex];
        const media = this.getMediaInfo(polygonIndex);

        let low = {
            height: polygon.floorHeight,
            textureOffset: v2scale(1 / worldUnitSize, polygon.floorOrigin),
            texture: polygon.floorTexture,
            transferMode: polygon.floorTransferMode,
            lightIntensity: this.getLightIntensity(polygon.floorLightsource),
        };

        let high = {
            height: polygon.ceilingHeight,
            textureOffset: v2scale(1 / worldUnitSize, polygon.ceilingOrigin),
            texture: polygon.ceilingTexture,
            transferMode: polygon.ceilingTransferMode,
            lightIntensity: this.getLightIntensity(polygon.ceilingLightsource),
        };

        if (media && playerHeight > media.height && media.height > low.height) {
            low = media;
        } else if (isSubmerged && media && playerHeight < media.height && media.height < high.height) {
            high = media;
        }

        return { floor: low, ceiling: high };
    }

    movePlayer(oldPosition: Vec2, position: Vec2, polygonIndex: number): [Vec2, number] {
        const polygon = this.polygons[polygonIndex];
        let intersection: Collision2d | null = null;
        let intersectLinePosition = null;
        for (let linePosition = 0; linePosition < polygon.lines.length; ++linePosition) {
            const line = this.getLineVertices(polygonIndex, linePosition);
            const thisIntersection = collideLineSegments([oldPosition, position], line);
            intersection = closerCollision(intersection, thisIntersection);
            if (intersection && intersection === thisIntersection) {
                intersectLinePosition = linePosition;
            }
        }
        if (intersection && intersectLinePosition !== null) {
            const portalTo = this.getPortal(polygonIndex, intersectLinePosition);
            if (portalTo !== undefined && portalTo !== null && portalTo !== -1) {
                return this.movePlayer(intersection.collidePosition, position, portalTo);
            } else {
                return [oldPosition, polygonIndex];
            }
        } else {
            return [position, polygonIndex];
        }
    }

    // cast a "ray" (really, find first intersection of world along line segment
    // between two points)
    intersectLineSegment(polygonIndex: number, startPosition: Vec3, endPosition: Vec3): RayCollision | null {
        const polygon = this.polygons[polygonIndex];
        const points = this.getPolygonPoints(polygonIndex);

        const floorIntercept = lineSegmentIntersectsHorizontalPolygon(
            startPosition, endPosition, points, polygon.floorHeight);
        if (floorIntercept) {
            return {
                polygonIndex,
                type: 'floor',
            };
        }

        const ceilingIntercept = lineSegmentIntersectsHorizontalPolygon(
            startPosition, endPosition, points, polygon.ceilingHeight);
        if (ceilingIntercept) {
            return {
                polygonIndex,
                type: 'ceiling',
            };
        }

        const startPosition2d: Vec2 = [startPosition[0], startPosition[1]];
        const endPosition2d: Vec2 = [endPosition[0], endPosition[1]];

        for (let wallIndex = 0; wallIndex < polygon.lines.length; ++wallIndex) {
            const line = this.getLineVertices(polygonIndex, wallIndex);
            const intersection = collideLineSegments([startPosition2d, endPosition2d], line);

            if (intersection) {
                const portalTo = this.getPortal(polygonIndex, wallIndex);
                if ((portalTo || portalTo === 0) && portalTo !== -1) {
                    const neighbor = this.polygons[portalTo];
                    const portalTop = Math.min(polygon.ceilingHeight, neighbor.ceilingHeight);
                    const portalBottom = Math.max(polygon.floorHeight, neighbor.floorHeight);

                    const hasTop = portalTop !== polygon.ceilingHeight;
                    const hasBottom = portalBottom !== polygon.floorHeight;

                    let sideTextureType = sideType.full;
                    if (hasTop && hasBottom) {
                        sideTextureType = sideType.split;
                    } else if (hasTop) {
                        sideTextureType = sideType.high;
                    } else if (hasBottom) {
                        sideTextureType = sideType.low;
                    }

                    const intersectHeight = lerp(intersection.t, startPosition[2], endPosition[2]);
                    if (intersectHeight > portalTop) {
                        return {
                            polygonIndex,
                            type: 'wallPrimary',
                            wallIndex,
                            sideType: sideTextureType,
                        };
                    } else if (intersectHeight < portalBottom) {
                        return {
                            polygonIndex,
                            type: polygon.ceilingHeight > neighbor.ceilingHeight
                                ? 'wallSecondary'
                                : 'wallPrimary',
                            wallIndex,
                            sideType: sideTextureType,
                        };
                    } else {
                        return this.intersectLineSegment(portalTo, startPosition, endPosition);
                    }
                } else {
                    return {
                        polygonIndex,
                        type: 'wallPrimary',
                        wallIndex,
                        sideType: sideType.full
                    };
                }
            }
        }

        return null;
    }
}
