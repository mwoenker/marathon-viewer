import {collideLineSegments, lineSegmentIntersectsHorizontalPolygon, closerCollision} from './collision.js';
import {lerp, floorMod} from './utils.js';
import {mediaDefinitions, sideType} from './files/wad.js';
import {makeShapeDescriptor} from './files/shapes.js';
export const worldUnitSize = 1024;

export class World {
    constructor(map) {
        this.map = map;
        this.points = map.points.map(([x, y]) => [x / worldUnitSize, y / worldUnitSize]);
        this.lines = map.lines;
        this.sides = map.sides;
        this.polygons = map.polygons.map(p => ({
            ...p,
            floorHeight: p.floorHeight / worldUnitSize,
            ceilingHeight: p.ceilingHeight / worldUnitSize,
        }));
        this.lights = map.lights;
        this.objects = map.objects;
        this.media = map.media;
        
        const transferModes = new Set();
        for (const side of this.sides) {
            transferModes.add(side.primaryTransferMode);
            transferModes.add(side.secondaryTransferMode);
            transferModes.add(side.transparentTransferMode);
        }

        for (const polygon of this.polygons) {
            transferModes.add(polygon.floorTransferMode);
            transferModes.add(polygon.ceilingTransferMode);
        }
    }

    getPolygon(polygonIndex) {
        if (polygonIndex < 0 || polygonIndex >= this.polygons.length) {
            throw new Error(`invalid polygon index: ${polygonIndex}`);
        }
        return this.polygons[polygonIndex];
    }

    getSide(sideIndex) {
        if (sideIndex < 0 || sideIndex >= this.sides.length) {
            throw new Error(`invalid side index: ${sideIndex}`);
        }
        return this.sides[sideIndex];
    }

    getPoint(pointIndex) {
        if (pointIndex < 0 || pointIndex >= this.points.length) {
            throw new Error(`invalid point index: ${pointIndex}`);
        }
        return this.points[pointIndex];
    }

    getEdgeVertices(edge) {
        const {lines, points} = this;
        const line = lines[edge.line];
        const [idx1, idx2] = edge.reverse ? [line[1], line[0]] : [line[0], line[1]];
        return [points[idx1], points[idx2]];
    }

    getLineVertices(polygonIndex, linePosition) {
        const polygon = this.polygons[polygonIndex];
        return [
            this.points[polygon.endpoints[linePosition]],
            this.points[polygon.endpoints[(linePosition + 1) % polygon.endpoints.length]]
        ];
    }

    getPortal(polygonIndex, linePosition) {
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

    getTexOffset(sideTexDef) {
        if (! sideTexDef) {
            return [0, 0];
        }
        return [
            floorMod(sideTexDef.offset[0], worldUnitSize) / worldUnitSize,
            floorMod(sideTexDef.offset[1], worldUnitSize) / worldUnitSize,
        ];
    }

    getLightIntensity(lightIndex) {
        const light = this.lights[lightIndex];
        const intensityFixed = light.primaryActive.intensity;
        return intensityFixed / 0xffff;
    }

    getPolygonPoints(polygonIndex) {
        const polygon = this.polygons[polygonIndex];
        return polygon.endpoints.map(index => this.points[index]);
    }

    getFloorOffset(polygonIndex) {
        const polygon = this.polygons[polygonIndex];
        return [
            polygon.floorOrigin[0] / worldUnitSize,
            polygon.floorOrigin[1] / worldUnitSize,
        ];
    }

    getCeilingOffset(polygonIndex) {
        const polygon = this.polygons[polygonIndex];
        return [
            polygon.ceilingOrigin[0] / worldUnitSize,
            polygon.ceilingOrigin[1] / worldUnitSize,
        ];
    }

    getMediaInfo(polygonIndex, seconds = 0) {
        const polygon = this.polygons[polygonIndex];
        const mediaIndex = polygon.media;
        
        if (mediaIndex === -1 || ! (mediaIndex in this.media)) {
            return null;
        }
        const media = this.media[mediaIndex];
        //const lightLevel = this.getLightIntensity(media.lightIndex);
        const lightLevel = 0.5 + Math.sin(seconds / 4) / 2;
        const height = lerp(lightLevel, media.low, media.high) / worldUnitSize;

        const def = mediaDefinitions[media.type];

        return {
            height,
            textureOffset: media.origin,
            texture: makeShapeDescriptor(0, def.collection, def.shape),
            transferMode: media.transferMode,
            lightIntensity: this.getLightIntensity(polygon.mediaLightsource),
        };
    }

    getPolygonFloorCeiling(polygonIndex, playerHeight, isSubmerged, seconds = 0) {
        const polygon = this.polygons[polygonIndex];
        const media = this.getMediaInfo(polygonIndex, seconds);
        
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

        return {floor: low, ceiling: high};
    }

    movePlayer(oldPosition, position, polygonIndex) {
        const polygon = this.polygons[polygonIndex];
        let intersection = null;
        let intersectLinePosition = null;
        for (let linePosition = 0; linePosition < polygon.lines.length; ++linePosition) {
            const line = this.getLineVertices(polygonIndex, linePosition);
            const thisIntersection = collideLineSegments([oldPosition, position], line);
            if ((! intersection && thisIntersection) ||
                (thisIntersection && thisIntersection.t < intersection.t))
            {
                intersection = thisIntersection;
                intersectLinePosition = linePosition;
            }
        }
        if (intersection) {
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
    intersectLineSegment(polygonIndex, startPosition, endPosition) {
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

        for (let wallIndex = 0; wallIndex < polygon.lines.length; ++wallIndex) {
            const line = this.getLineVertices(polygonIndex, wallIndex);
            const intersection = collideLineSegments([startPosition, endPosition], line);
            const sideIndex = polygon.sides[wallIndex];
            
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
