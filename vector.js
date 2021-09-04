export function vlength([x, y]) {
    return Math.sqrt(x * x + y * y);
}

export function vscale(factor, [x, y]) {
    return [x * factor, y * factor];
}

export function vnormalize(v) {
    return vscale(1 / vlength(v), v);
}

export function vadd([x1, y1], [x2, y2]) {
    return [x1 + x2, y1 + y2];
}

export function vsub([x1, y1], [x2, y2]) {
    return [x1 - x2, y1 - y2];
}

export function vdot([x1, y1], [x2, y2]) {
    return x1 * x2 + y1 * y2;
}

export function vlerp(t, v1, v2) {
    return vadd(vscale(1 - t, v1), vscale(t, v2));
}

export function vdirection(radians) {
    return [Math.cos(radians), Math.sin(radians)];
}

export function isClockwise(v1, v2, v3) {
    const d1 = vsub(v2, v1);
    const d2 = vsub(v3, v2);
    return (d1[0] * d2[1]) - (d1[1] * d2[0]) > 0;
}
