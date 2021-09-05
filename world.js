import { collideLineSegments } from './collision.js';

export class World {
    constructor() {
        this.points = [
            [1, 0], // 0
            [2, 0], // 1
            [3, 1], // 2
            [2, 2], // 3
            [1, 2], // 4
            [0, 1], // 5

            [2, -2], // 6
            [3, -2], // 7
            [3, -1], // 8

            [5, -2], // 9
            [5, -1], // 10
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
                top: 4,
                bottom: 0
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
                top: 1,
                bottom: -2,
            }
        ];
    }

    getEdgeVertices(edge) {
        const {lines, points} = this;
        const line = lines[edge.line];
        const [idx1, idx2] = edge.reverse ? [line[1], line[0]] : [line[0], line[1]];
        return [points[idx1], points[idx2]];
    }

    movePlayer(oldPosition, position, polygonIndex) {
        const polygon = this.polygons[polygonIndex];
        let intersection = null;
        let intersectEdge = null;
        for (const edgeIndex of polygon.edges) {
            const edge = this.edges[edgeIndex];
            const line = this.getEdgeVertices(this.edges[edgeIndex]);
            const thisIntersection = collideLineSegments([oldPosition, position], line);
            if ((! intersection && thisIntersection) ||
                (thisIntersection && thisIntersection.t < intersection.t))
            {
                intersection = thisIntersection;
                intersectEdge = edge;
            }
        }
        if (intersection) {
            console.log({intersectEdge});
            if (intersectEdge.portalTo !== undefined && intersectEdge.portalTo !== null) {
                console.log('portal', intersectEdge.portalTo);
                return this.movePlayer(intersection.collidePosition, position, intersectEdge.portalTo);
            } else {
                console.log('bonk');
                return [oldPosition, polygonIndex];
                // return [intersection.collidePosition, polygonIndex];
            }
        } else {
            return [position, polygonIndex];
        }

    }
}
