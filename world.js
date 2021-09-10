import { collideLineSegments } from './collision.js';

export class World {
    constructor(map) {
        this.points = map.points.map(([x, y]) => [x / 1024, y / 1024]);
        this.lines = map.lines;
        this.sides = map.sides;
        this.polygons = map.polygons.map(p => ({
            ...p,
            floorHeight: p.floorHeight / 1024,
            ceilingHeight: p.ceilingHeight / 1024,
        }));
        this.lights = map.lights;
        this.objects = map.objects;
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
            (sideTexDef.offset[0] & 1023) / 1024,
            (sideTexDef.offset[1] & 1023) / 1024,
        ];
    }

    getLightIntensity(lightIndex) {
        const light = this.lights[lightIndex];
        const intensityFixed = light.primaryActive.intensity;
        return intensityFixed / 0xffff;
    }

    getFloorOffset(polygonIndex) {
        const polygon = this.polygons[polygonIndex];
        return [
            polygon.floorOrigin[0] / 1024,
            polygon.floorOrigin[1] / 1024,
        ];
    }

    getCeilingOffset(polygonIndex) {
        const polygon = this.polygons[polygonIndex];
        return [
            polygon.ceilingOrigin[0] / 1024,
            polygon.ceilingOrigin[1] / 1024,
        ];
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
}

export const worldUnitSize = 1024;
