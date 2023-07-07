import { Vec2 } from "../../vector2";
import { findLinesToLeft, findPolygonToFill } from "./fillPolygon";

class MockLine {
    constructor(
        public begin: number,
        public end: number,
        public frontPoly = -1,
        public backPoly = -1) { }
}

class MockMap {
    constructor(public points: Vec2[], public lines: MockLine[]) { }
    getPoint(index: number) {
        return this.points[index];
    }
    getLine(index: number) {
        return this.lines[index];
    }
    getPolygonOnLineSide(lineIndex: number, isFront: boolean): number {
        const line = this.getLine(lineIndex);
        return isFront ? line.frontPoly : line.backPoly;
    }
}

describe('findLinesToLeft', () => {
    it('finds intersections left of point', () => {
        const map = new MockMap(
            [
                [0, 100],
                [100, 0],
                [200, 100],
                [100, 200],
                [20, 0],
                [20, 400],
            ],
            [
                new MockLine(0, 1),
                new MockLine(1, 2),
                new MockLine(2, 3),
                new MockLine(3, 0),
                new MockLine(4, 5),
            ]
        );

        const lines = findLinesToLeft([100, 80], map);
        expect(lines).toHaveLength(2);
        expect(lines.find(line => line.line.begin === 0 && line.line.end === 1)).toBeDefined();
        expect(lines.find(line => line.line.begin === 4 && line.line.end === 5)).toBeDefined();
    });
});

describe('findPolygonToFill', () => {
    it('finds basic polygon', () => {
        const map = new MockMap(
            [
                [0, 100],
                [100, 0],
                [200, 100],
                [100, 200],
            ],
            [
                new MockLine(0, 1),
                new MockLine(1, 2),
                new MockLine(2, 3),
                new MockLine(3, 0),
            ]
        );
        const sides = findPolygonToFill([100, 99], map);
        expect(sides).toHaveLength(4);
        expect(sides![0].lineIndex).toBe(0);
        expect(sides![1].lineIndex).toBe(1);
        expect(sides![2].lineIndex).toBe(2);
        expect(sides![3].lineIndex).toBe(3);
        expect(sides!.every(side => side.isFront)).toBeTruthy();
    });

    it('rejects if polygon already exists', () => {
        const map = new MockMap(
            [
                [0, 100],
                [100, 0],
                [200, 100],
                [100, 200],
            ],
            [
                new MockLine(0, 1),
                new MockLine(1, 2, 0),
                new MockLine(2, 3),
                new MockLine(3, 0),
            ]
        );
        const sides = findPolygonToFill([100, 99], map);
        expect(sides).toBeUndefined();
    });

    it('finds if polygon on other side of line', () => {
        const map = new MockMap(
            [
                [0, 100],
                [100, 0],
                [200, 100],
                [100, 200],
            ],
            [
                new MockLine(0, 1),
                new MockLine(1, 2, -1, 0),
                new MockLine(2, 3),
                new MockLine(3, 0),
            ]
        );
        const sides = findPolygonToFill([100, 99], map);
        expect(sides).toHaveLength(4);
        expect(sides![0].lineIndex).toBe(0);
        expect(sides![1].lineIndex).toBe(1);
        expect(sides![2].lineIndex).toBe(2);
        expect(sides![3].lineIndex).toBe(3);
        expect(sides!.every(side => side.isFront)).toBeTruthy();
    });

    it('rejects convex polygon', () => {
        const map = new MockMap(
            [
                [0, 100],
                [100, 0],
                [90, 100],
                [100, 200],
            ],
            [
                new MockLine(0, 1),
                new MockLine(1, 2),
                new MockLine(2, 3),
                new MockLine(3, 0),
            ]
        );
        const sides = findPolygonToFill([50, 100], map);
        expect(sides).toBeUndefined();
    });

    it('rejects convex polygon to left of point', () => {
        const map = new MockMap(
            [
                [0, 100],
                [100, 0],
                [90, 100],
                [100, 200],
            ],
            [
                new MockLine(0, 1),
                new MockLine(1, 2),
                new MockLine(2, 3),
                new MockLine(3, 0),
            ]
        );
        const sides = findPolygonToFill([100, 50], map);
        expect(sides).toBeUndefined();
    });

    it('finds innermost containing polygon', () => {
        const map = new MockMap(
            [
                [0, 100],
                [100, 0],
                [200, 100],
                [100, 200],
                [300, 100],
            ],
            [
                new MockLine(0, 1),
                new MockLine(1, 2),
                new MockLine(2, 3),
                new MockLine(3, 0),
                new MockLine(1, 4),
                new MockLine(4, 3),
            ]
        );
        const sides = findPolygonToFill([100, 99], map);
        expect(sides).toHaveLength(4);
        expect(sides![0].lineIndex).toBe(0);
        expect(sides![1].lineIndex).toBe(1);
        expect(sides![2].lineIndex).toBe(2);
        expect(sides![3].lineIndex).toBe(3);
    });

    it('is not confused by better seeming path that does not terminate', () => {
        const map = new MockMap(
            [
                [0, 100],
                [100, 0],
                [200, 100],
                [100, 200],
                [150, 100],
            ],
            [
                new MockLine(0, 1),
                new MockLine(1, 2),
                new MockLine(2, 3),
                new MockLine(3, 0),
                new MockLine(1, 4),
            ]
        );
        const sides = findPolygonToFill([100, 99], map);
        expect(sides).toHaveLength(4);
        expect(sides![0].lineIndex).toBe(0);
        expect(sides![1].lineIndex).toBe(1);
        expect(sides![2].lineIndex).toBe(2);
        expect(sides![3].lineIndex).toBe(3);
    });

    it('is not confused by better seeming path that does not terminate even if line is first left intersect', () => {
        const map = new MockMap(
            [
                [0, 100],
                [100, 0],
                [200, 100],
                [100, 200],
                [105, 0],
            ],
            [
                new MockLine(0, 1),
                new MockLine(1, 2),
                new MockLine(2, 3),
                new MockLine(3, 0),
                new MockLine(0, 4),
            ]
        );
        const sides = findPolygonToFill([100, 99], map);
        expect(sides).toHaveLength(4);
        expect(sides![0].lineIndex).toBe(0);
        expect(sides![1].lineIndex).toBe(1);
        expect(sides![2].lineIndex).toBe(2);
        expect(sides![3].lineIndex).toBe(3);
    });

    it('order of points does not matter', () => {
        const map = new MockMap(
            [
                [0, 100],
                [100, 0],
                [200, 100],
                [100, 200],
            ],
            [
                new MockLine(0, 1),
                new MockLine(2, 1),
                new MockLine(2, 3),
                new MockLine(0, 3),
            ]
        );

        const sides = findPolygonToFill([100, 99], map);
        expect(sides).toHaveLength(4);
        expect(sides![0].lineIndex).toBe(0);
        expect(sides![1].lineIndex).toBe(1);
        expect(sides![2].lineIndex).toBe(2);
        expect(sides![3].lineIndex).toBe(3);
    });

    it('doesn\'t find bigger polygon than necessary', () => {
        const map = new MockMap(
            [
                [-100, 0],
                [0, -100],
                [100, 0],
                [0, 100]
            ],
            [
                new MockLine(0, 1),
                new MockLine(1, 2),
                new MockLine(2, 0),
                new MockLine(2, 3),
                new MockLine(3, 0),
            ],
        );

        const sides = findPolygonToFill([0, 10], map);
        expect(sides).toHaveLength(3);
        expect(sides![0].lineIndex).toBe(4);
        expect(sides![1].lineIndex).toBe(2);
        expect(sides![2].lineIndex).toBe(3);
    });

    it('doesn\'t find bigger polygon than necessary (2)', () => {
        const map = new MockMap(
            [
                [-100, 0],
                [0, -100],
                [100, 0],
                [0, 100]
            ],
            [
                new MockLine(0, 1),
                new MockLine(1, 3),
                new MockLine(3, 0),
                new MockLine(1, 2),
                new MockLine(2, 3),
            ],
        );

        const sides = findPolygonToFill([-10, -10], map);
        expect(sides).toHaveLength(3);
        expect(sides![0].lineIndex).toBe(0);
        expect(sides![1].lineIndex).toBe(1);
        expect(sides![2].lineIndex).toBe(2);
    });
});
