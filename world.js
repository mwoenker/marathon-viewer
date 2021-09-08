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

        /*
        this.points = [
            [1, 0], //0
            [2, 0], //1
            [3, 1], //2
            [2, 2], //3
            [1, 2], //4
            [0, 1], //5

            [2, -2], //6
            [3, -2], //7
            [3, -1], //8

            [5, -2], //9
            [5, -1], //10
        ];

        this.lines = [
            [0, 1], // 0
            [1, 2],
            [2, 3],
            [3, 4],
            [4, 5],
            [5, 0],

            [1, 6], // 6
            [6, 7],
            [7, 8],
            [8, 2],

            [7, 9], // 10
            [9, 10],
            [10, 8],
        ];

        this.edges = [
            { // 0
                line: 0,
                texture: 20,
            },
            {
                line: 1,
                texture: 21,
                portalTo: 1,
            },
            {
                line: 2,
                texture: 22,
            },
            {
                line: 3,
                texture: 23,
            },
            {
                line: 4,
                texture: 24,
            },
            {
                line: 5,
                texture: 25,
            },

            { // 6
                line: 1,
                texture: 13,
                reverse: true,
                portalTo: 0,
            },
            {
                line: 6,
                texture: 10,
            },
            {
                line: 7,
                texture: 11,
            },
            {
                line: 8,
                texture: 12,
                portalTo: 2,
            },
            {
                line: 9,
                texture: 13,
            },

            { // 11
                line: 10,
                texture: 14,
            },
            {
                line: 11,
                texture: 15,
            },
            {
                line: 12,
                texture: 16,
            },
            {
                line: 8,
                texture: 17,
                reverse: true,
                portalTo: 1,
            },
        ];

        this.polygons = [
            {
                edges: [
                    0, 1, 2, 3, 4, 5
                ],
                top: 2,
                bottom: -0.2
            },
            {
                edges: [
                    6, 7, 8, 9, 10
                ],
                top: 1,
                bottom: 0,
            },
            {
                edges: [
                    11, 12, 13, 14
                ],
                top: 3,
                bottom: -0.5,
            }
        ];

        for (let i = 0; i < this.points.length; ++i) {
            this.points[i][0] *= 2;
            this.points[i][1] *= 2;
        }
        */
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
        // return [
        //     (sideTexDef.offset[0] & 1023) / 1024,
        //     (sideTexDef.offset[1] & 1023) / 1024,
        // ];
        return window.transform(sideTexDef.offset[0], sideTexDef.offset[1]);
    }

    getLightIntensity(lightIndex) {
        const light = this.lights[lightIndex];
        const intensityFixed = light.primaryActive.intensity;
        return intensityFixed / 0xffff;
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
