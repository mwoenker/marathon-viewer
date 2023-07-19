import { Collision2d, closerCollision, collideLineSegments, lineSegmentIntersectsHorizontalPolygon } from './collision';
import { lerp, floorMod } from './utils';
import { v2scale, Vec2, v2 } from './vector2';
import { Vec3 } from './vector3';
import { Side, SideTex } from './files/map/side';
import { Polygon } from './files/map/polygon';
import { ObjectType, ObjectFlags } from './files/map/object';
import { mediaDefinitions } from './files/wad';
import { MapGeometry } from './files/map';
import { Surface } from './surface';
import { makeShapeDescriptor } from './files/shapes';
import { LightState } from './light';
import { playerHeight } from './player';
import { worldUnitSize, numFixedAngles } from './constants';

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

interface PlayerStartPosition {
    polygon: number
    position: Vec2
    height: number
    facing: number
}

export class World {
    map: MapGeometry;
    lightState: LightState[];
    timeElapsed: number;

    constructor(map: MapGeometry) {
        this.map = map;
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
    }

    getPolygon(polygonIndex: number): Polygon {
        if (polygonIndex < 0 || polygonIndex >= this.map.polygons.length) {
            throw new Error(`invalid polygon index: ${polygonIndex}`);
        }
        return this.map.polygons[polygonIndex];
    }

    getSide(sideIndex: number): Side | null {
        if (sideIndex < 0 || sideIndex >= this.map.sides.length) {
            return null;
        }
        return this.map.sides[sideIndex];
    }

    getPoint(pointIndex: number): Vec2 {
        if (pointIndex < 0 || pointIndex >= this.map.points.length) {
            throw new Error(`invalid point index: ${pointIndex}`);
        }
        return this.map.points[pointIndex];
    }

    getLineVertices(polygonIndex: number, linePosition: number): [Vec2, Vec2] {
        const polygon = this.map.polygons[polygonIndex];
        return [
            this.map.points[polygon.endpoints[linePosition]],
            this.map.points[polygon.endpoints[(linePosition + 1) % polygon.endpoints.length]]
        ];
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
        const lightState = this.lightState[lightIndex]
        if (!lightState) {
            throw new Error(`light state not found: ${lightIndex}`);
        }
        const intensity = lightState.intensity / 0x10000;
        return intensity;
    }

    getPolygonPoints(polygonIndex: number): Vec2[] {
        const polygon = this.map.polygons[polygonIndex];
        return polygon.endpoints.map(index => this.map.points[index]);
    }

    getFloorOffset(polygonIndex: number): Vec2 {
        const polygon = this.map.polygons[polygonIndex];
        return [
            polygon.floorOrigin[0] / worldUnitSize,
            polygon.floorOrigin[1] / worldUnitSize,
        ];
    }

    getCeilingOffset(polygonIndex: number): Vec2 {
        const polygon = this.map.polygons[polygonIndex];
        return [
            polygon.ceilingOrigin[0] / worldUnitSize,
            polygon.ceilingOrigin[1] / worldUnitSize,
        ];
    }

    getMediaInfo(polygonIndex: number): HorizontalSurfaceInfo | null {
        const polygon = this.map.polygons[polygonIndex];
        const mediaIndex = polygon.media;

        if (mediaIndex === -1 || !(mediaIndex in this.map.media)) {
            return null;
        }
        const media = this.map.media[mediaIndex];
        const lightLevel = this.getLightIntensity(media.lightIndex);
        // const lightLevel = 0.5 + Math.sin(seconds / 4) / 2;
        const height = lerp(lightLevel, media.low, media.high);

        const def = mediaDefinitions[media.type];

        return {
            height,
            textureOffset: v2scale(1 / worldUnitSize, media.originAtTime(this.timeElapsed)), // media.origin,
            texture: makeShapeDescriptor(def.collection, 0, def.shape),
            transferMode: media.transferMode,
            lightIntensity: this.getLightIntensity(polygon.mediaLightsource),
        };
    }

    getPolygonFloorCeiling(
        polygonIndex: number,
        playerHeight: number,
        isSubmerged: boolean): FloorCeilingInfo {
        const polygon = this.map.polygons[polygonIndex];
        const media = this.getMediaInfo(polygonIndex);

        let low = {
            height: polygon.floorHeight,
            textureOffset: polygon.floorOrigin,
            texture: polygon.floorTexture,
            transferMode: polygon.floorTransferMode,
            lightIntensity: this.getLightIntensity(polygon.floorLightsource),
        };

        let high = {
            height: polygon.ceilingHeight,
            textureOffset: polygon.ceilingOrigin,
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

    playerStartPosition(): PlayerStartPosition {
        for (const mapObject of this.map.objects) {
            if (mapObject.type === ObjectType.player) {
                const polygon = mapObject.polygon;
                const pos3d = mapObject.position;
                const position = v2(pos3d[0], pos3d[1]);
                let height: number;
                if (mapObject.flags & ObjectFlags.hangingFromCeiling) {
                    height = this.map.polygons[polygon].ceilingHeight
                        + pos3d[2] + playerHeight;
                } else {
                    height = this.map.polygons[polygon].floorHeight
                        + pos3d[2] + playerHeight;
                }
                const facing = fromFixedAngle(mapObject.facing);
                return { polygon, position, height, facing };
            }
        }

        throw new Error('No player object found');
    }

    movePlayer(oldPosition: Vec2, position: Vec2, polygonIndex: number): [Vec2, number] | null {
        const polygon = this.map.polygons[polygonIndex];
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
            const portalTo = this.map.getPortal(polygonIndex, intersectLinePosition);
            if (portalTo !== undefined && portalTo !== null && portalTo !== -1) {
                //return this.movePlayer(intersection.collidePosition, position, portalTo);
                return this.movePlayer(oldPosition, position, portalTo);
            } else {
                return null;
            }
        } else {
            return [position, polygonIndex];
        }
    }

    // cast a "ray" (really, find first intersection of world along line segment
    // between two points)
    intersectLineSegment(polygonIndex: number, startPosition: Vec3, endPosition: Vec3): Surface | null {
        const polygon = this.map.polygons[polygonIndex];
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

        const startPosition2d = v2(startPosition[0], startPosition[1]);
        const endPosition2d = v2(endPosition[0], endPosition[1]);

        for (let wallIndex = 0; wallIndex < polygon.lines.length; ++wallIndex) {
            const line = this.getLineVertices(polygonIndex, wallIndex);
            const intersection = collideLineSegments([startPosition2d, endPosition2d], line);

            if (intersection) {
                const portalTo = this.map.getPortal(polygonIndex, wallIndex);
                if (portalTo !== -1) {
                    const neighbor = this.map.polygons[portalTo];
                    const portalTop = Math.min(polygon.ceilingHeight, neighbor.ceilingHeight);
                    const portalBottom = Math.max(polygon.floorHeight, neighbor.floorHeight);

                    const intersectHeight = lerp(intersection.t, startPosition[2], endPosition[2]);
                    if (intersectHeight > portalTop) {
                        return {
                            polygonIndex,
                            type: 'wallPrimary',
                            wallIndex,
                        };
                    } else if (intersectHeight < portalBottom) {
                        return {
                            polygonIndex,
                            type: polygon.ceilingHeight > neighbor.ceilingHeight
                                ? 'wallSecondary'
                                : 'wallPrimary',
                            wallIndex,
                        };
                    } else {
                        return this.intersectLineSegment(portalTo, startPosition, endPosition);
                    }
                } else {
                    return {
                        polygonIndex,
                        type: 'wallPrimary',
                        wallIndex,
                    };
                }
            }
        }

        return null;
    }
}
