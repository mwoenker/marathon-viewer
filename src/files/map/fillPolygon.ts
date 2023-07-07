/*

  user clicks fill tool at a point

  shoot a ray left until we hit a line. If we're in a valid polygon, this line
  will be part of it.

  We will try to traverse this polygon line by line. We will start with the
  upper point of the line we hit. The next line will be attached to that
  point. We do a depth first search of lines attached to that point, lines
  attached to the opposite points of those lines, and so on.

  We can ignore connecting lines that turn to the left (therefore making the
  polygon concave), as well as making sure not to do a 180 degree turn and go
  right back along the line we came from.

  At each step, we will prefer the connecting line that makes the sharpest
  rightward turn. If we run out of valid candidate connecting lines at a certain
  depth, we backtrack.

  If at any point we connect back to the line we started at, we have
  successfully found a polygon. Before creating a new polygon we must check for
  a few things. First, the polygon must have between 3 and 8 lines.  We also
  need to make sure that all of the lines are not already part of a polygon on
  the relevant sides.  We don't have to check for convexity since the above
  process should guarantee it.

  Actually this has a weird property; the fill might work on geometry that
  doesnt work if it's rotated 90 or 180 degrees. Because we're tolerant of stray
  lines inside the polygon, but not if they're immediately to the left of the
  ponit, because of the way we find the initial line. To make it consistent I
  think we would have to sort all lines to the left and try each one in order
  until we find one that works. After we would need to test if the found polygon
  contains the start point.

  All of this makes me wonder if it's even worth being as tolerant of weird
  geometry as we are. Maybe users might actually be confused by the results of
  us filling some of these polygons with weird stray nonconvex or disconnected
  paths in the middle. It appears that weland won't let you fill any polygon
  with weird lines connected. It will let you fill polygons with weird lines in
  the middle that _aren't_ connected. I don't know what algorithm it uses. To
  duplicate the behavior that I've observed, we would traverse the lines
  optimistically and just fail rather than backtracking, but we would have to be
  better at finding the initial side -- maybe doing what I said above where we
  look at successively further and further left lines, and finally checking to
  see if the polygon contains the start point.

*/

import { lerp } from "../../utils";
import { v2lerp, v2sub, Vec2 } from "../../vector2";

// simplified types for easier testing
interface Line {
    begin: number;
    end: number;
}

// simplified types for easier testing
interface MapGeometry {
    lines: Line[];
    getPoint(index: number): Vec2;
    getLine(index: number): Line;
    getPolygonOnLineSide(lineIndex: number, isFront: boolean): number;
}

interface LineLeftCandidate {
    lineIndex: number;
    line: Line;
    interceptX: number;
}

export interface SideCandidate {
    lineIndex: number;
    isFront: boolean;
    startPointIndex: number; // first as we are traversing polygon clockwise
    endPointIndex: number; // second as we are traversing polygon clockwise
}

function leftInterceptCandidate(point: Vec2, lineIndex: number, map: MapGeometry): LineLeftCandidate | undefined {
    const line = map.getLine(lineIndex);
    const { begin, end } = line;
    const p1 = map.getPoint(begin);
    const p2 = map.getPoint(end);
    const top = Math.min(p1[1], p2[1]);
    const bottom = Math.max(p1[1], p2[1]);

    if (point[1] < top || point[1] >= bottom) {
        // line is entirely above or below point
        return;
    }

    const interceptT = (point[1] - p1[1]) / (p2[1] - p1[1]);
    const intercept = v2lerp(interceptT, p1, p2);

    if (intercept[0] > point[0]) {
        // line is to the right
        return;
    }

    return {
        lineIndex,
        line,
        interceptX: intercept[0],
    };
}

function assertSidesConnected(sides: SideCandidate[]) {
    for (let i = 0; i < sides.length; ++i) {
        const nextI = (i + 1) % sides.length;
        const side = sides[i];
        const nextSide = sides[nextI];
        if (side.endPointIndex !== nextSide.startPointIndex) {
            throw new Error('Sides of polygon not connected!');
        }
    }
}

function sidesContainPoint(map: MapGeometry, sides: SideCandidate[], point: Vec2) {
    // find intersections with line y = point[1]. There should be even number of
    // intersections to left of point, and to right of point. In fact for a
    // convex polygon both numbers should be exactly 1
    let leftIntersections = 0;
    let rightIntersections = 0;

    for (const side of sides) {
        const p1 = map.getPoint(side.startPointIndex);
        const p2 = map.getPoint(side.endPointIndex);
        let topVertex: Vec2, bottomVertex: Vec2;
        if (p1[1] < p2[1]) {
            topVertex = p1;
            bottomVertex = p2;
        } else {
            topVertex = p2;
            bottomVertex = p1;
        }

        if (point[1] >= topVertex[1] && point[1] < bottomVertex[1]) {
            const intersectionT = (point[1] - topVertex[1]) /
                (bottomVertex[1] - topVertex[1]);
            const intersectionX = lerp(intersectionT, topVertex[0], bottomVertex[0]);
            if (intersectionX < point[0]) {
                ++rightIntersections;
            } else {
                ++leftIntersections;
            }
        }
    }

    return (leftIntersections % 2) === 1 && (rightIntersections % 2) === 1;
}

function bestCandidate(
    a: LineLeftCandidate | undefined,
    b: LineLeftCandidate | undefined
): LineLeftCandidate | undefined {
    if (!a) {
        return b;
    } else if (!b) {
        return a;
    } else if (a.interceptX > b.interceptX) {
        return a;
    } else {
        return b;
    }
}

function isDefined<T>(thing: T | undefined): thing is T {
    return thing !== undefined;
}

export function findLinesToLeft(point: Vec2, map: MapGeometry): LineLeftCandidate[] {
    return map.lines
        .map((_, lineIndex) => leftInterceptCandidate(point, lineIndex, map))
        .filter(isDefined)
        .sort((a, b) => b.interceptX - a.interceptX);
}

function topPointOfLineIndex(line: Line, map: MapGeometry): number {
    const startPoint = map.getPoint(line.begin);
    const endPoint = map.getPoint(line.end);

    return startPoint[1] < endPoint[1]
        ? line.begin
        : line.end;
}

function signedAngleBetweenSideDirections(map: MapGeometry, a: SideCandidate, b: SideCandidate) {
    if (a.endPointIndex !== b.startPointIndex) {
        throw new Error('Lines not connected');
    }
    const p1 = map.getPoint(a.startPointIndex);
    const p2 = map.getPoint(a.endPointIndex);
    const p3 = map.getPoint(b.endPointIndex);

    const aDirection = v2sub(p2, p1);
    const bDirection = v2sub(p3, p2);

    const v1 = aDirection[0];
    const v2 = aDirection[1];
    const w1 = bDirection[0];
    const w2 = bDirection[1];

    return Math.atan2(
        aDirection[0] * bDirection[1] - aDirection[1] * bDirection[0],
        aDirection[0] * bDirection[0] + aDirection[1] * bDirection[1],
    );
}

function makeSideCandidate(map: MapGeometry, startPointIndex: number, lineIndex: number): SideCandidate {
    const line = map.getLine(lineIndex);
    const isFront = line.begin === startPointIndex;
    const [, endPointIndex] = linePointIndexes(line, isFront);
    return {
        lineIndex,
        isFront,
        startPointIndex,
        endPointIndex
    };
}

function sidesConnectingClockwiseToLine(
    map: MapGeometry,
    startSide: SideCandidate,
    terminatingSide: SideCandidate,
    depth = 1
): SideCandidate[] | undefined {
    if (depth > 8) {
        return;
    }

    const connectingSides = map.lines
        .map((line, lineIndex) => [line, lineIndex] as const)
        .filter(([line, lineIndex]) =>
            lineIndex !== startSide.lineIndex && (
                line.begin === startSide.endPointIndex ||
                line.end === startSide.endPointIndex))
        .map(([, lineIndex]) => makeSideCandidate(
            map,
            startSide.endPointIndex,
            lineIndex,
        ))
        .filter(side => signedAngleBetweenSideDirections(map, startSide, side) >= 0);

    // search the lines that twist most aggressively clockwise first
    connectingSides.sort((a, b) =>
        signedAngleBetweenSideDirections(map, startSide, b) -
        signedAngleBetweenSideDirections(map, startSide, a)
    );

    if (connectingSides.some(side => side.lineIndex === terminatingSide.lineIndex)) {
        return [startSide];
    }

    for (const side of connectingSides) {
        const restOfPath = sidesConnectingClockwiseToLine(
            map,
            side,
            terminatingSide,
            depth + 1
        );

        if (restOfPath) {
            return [startSide, ...restOfPath];
        }
    }
}

function linePointIndexes(line: Line, isFront: boolean): [number, number] {
    return isFront ? [line.begin, line.end] : [line.end, line.begin];
}

function isFillable(map: MapGeometry, sides: SideCandidate[]): boolean {
    for (const side of sides) {
        // should take line index?
        if (-1 !== map.getPolygonOnLineSide(side.lineIndex, side.isFront)) {
            return false;
        }
    }
    return true;
}

export function findPolygonToFill(
    point: Vec2,
    map: MapGeometry
): SideCandidate[] | undefined {
    const startLines = findLinesToLeft(point, map);

    for (const startLine of startLines) {
        const connectingPointIndex = topPointOfLineIndex(startLine.line, map);
        const isFront = connectingPointIndex === startLine.line.end;
        const [startPointIndex] = linePointIndexes(startLine.line, isFront);

        const startSide = makeSideCandidate(map, startPointIndex, startLine.lineIndex);

        const sides = sidesConnectingClockwiseToLine(
            map,
            startSide,
            startSide,
        );


        if (sides) {
            assertSidesConnected(sides);
        }

        if (sides && sides.length >= 3 &&
            sides.length <= 8 &&
            sidesContainPoint(map, sides, point) &&
            isFillable(map, sides)) {
            return sides;
        }
    }
}
