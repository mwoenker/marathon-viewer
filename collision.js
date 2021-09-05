import {v2add, v2sub, v2dot, v2scale} from './vector.js';

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
