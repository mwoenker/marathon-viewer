import {vadd, vsub, vdot, vscale} from './vector.js';

export function collideLineSegments(collidingLine, targetLine) {
    const targetDiff = vsub(targetLine[1], targetLine[0]);
    const tangent = [-targetDiff[1], targetDiff[0]];
    const lineDist = vdot(tangent, targetLine[0]);
    const distFromLine = (v) => vdot(v, tangent) - lineDist;
    const dist1 = distFromLine(collidingLine[0]);
    const dist2 = distFromLine(collidingLine[1]);
    if (dist1 > 0 && dist2 <= 0) {
        const collidingDiff = vsub(collidingLine[1], collidingLine[0]);
        const t = -dist1 / (dist2 - dist1);
        const collidePosition = vadd(collidingLine[0], vscale(t, collidingDiff));
        const dot = vdot(vsub(collidePosition, targetLine[0]), targetDiff);
        if (dot < 0 || dot > vdot(targetDiff, targetDiff)) {
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
