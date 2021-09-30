import { v2add, v2sub, v2dot, v2scale, v2length } from './vector2';
import { v3add, v3sub, v3dot, v3scale, v3lerp } from './vector3';

export function collideLineSegments(collidingLine, targetLine) {
    const targetDiff = v2sub(targetLine[1], targetLine[0]);
    const tangent = [-targetDiff[1], targetDiff[0]];
    const lineDist = v2dot(tangent, targetLine[0]);
    const distFromLine = (v) => v2dot(v, tangent) - lineDist;
    const dist1 = distFromLine(collidingLine[0]);
    const dist2 = distFromLine(collidingLine[1]);
    if (dist1 > 0 && dist2 <= 0) {
        const collidingDiff = v2sub(collidingLine[1], collidingLine[0]);
        const t = -dist1 / (dist2 - dist1);
        const collidePosition = v2add(collidingLine[0], v2scale(t, collidingDiff));
        const dot = v2dot(v2sub(collidePosition, targetLine[0]), targetDiff);
        if (dot < 0 || dot > v2dot(targetDiff, targetDiff)) {
            return null;
        } else {
            return {
                t,
                collidePosition
            };
        }
    } else {
        return null;
    }
}

export function closerCollision(c1, c2) {
    if (null === c1) {
        return c2;
    } else if (null === c2) {
        return c1;
    } else if (c1.t < c2.t) {
        return c1;
    } else {
        return c2;
    }
}

export function pointInPolygon2d(position, polyVertices) {
    let yLeftIntercepts = 0;
    for (let i = 0; i < polyVertices.length; ++i) {
        const p1 = polyVertices[i];
        const p2 = polyVertices[(i + 1) % polyVertices.length];
        if (position[1] >= p1[1] && position[1] < p2[1] ||
            position[1] >= p2[1] && position[1] < p1[1]
        ) {
            const t = (position[1] - p1[1]) / (p2[1] - p1[1]);
            const lineX = p1[0] + t * (p2[0] - p1[0]);
            if (lineX < position[0]) {
                ++yLeftIntercepts;
            }
        }
    }
    return yLeftIntercepts === 1;
}

export function lineSegmentIntersectsHorizontalPolygon(lineStart, lineEnd, positions2d, height) {
    if ((lineStart[2] < height) !== (lineEnd[2] < height)) {
        const t = (height - lineStart[2]) / (lineEnd[2] - lineStart[2]);
        const planeIntercept = v3lerp(t, lineStart, lineEnd);
        const intercept2d = [planeIntercept[0], planeIntercept[1]];
        if (pointInPolygon2d(intercept2d, positions2d)) {
            return {
                t,
                collidePosition: planeIntercept,
            };
        } else {
            return null;
        }
    } else {
        return null;
    }
}

export function rayIntersectsZPlane3d(position, direction, planeHeight) {
    const t = (planeHeight - position[2]) / direction[2];
    if (t >= 0) {
        return {
            t,
            collidePosition: v3add(position, v3scale(t, direction)),
        };
    } else {
        return null;
    }
}

export function rayIntersectsLineSegment2d(position, direction, [lineStart, lineEnd]) {
    const lineDirection = v2sub(lineEnd, lineStart);
    const normal = [-lineDirection[1], lineDirection[0]];
    const distZero = v2dot(normal, lineStart);
    const rayProjected = v2dot(direction, normal);

    if (rayProjected === 0) { // should use epsilon?
        return null;
    }

    const projectedDistance = v2dot(position, normal) - distZero;
    const multiplier = -projectedDistance / rayProjected;

    if (multiplier < 0) {
        return null;
    }

    const lineIntersection = v2add(position, v2scale(multiplier, direction));
    const lineT = v2dot(
        lineDirection,
        v2sub(lineIntersection, lineStart)) / v2length(lineDirection);

    if (lineT < 0 || lineT > 1) {
        return null;
    }

    return {
        t: multiplier,
        collidePosition: lineIntersection,
    };
}
