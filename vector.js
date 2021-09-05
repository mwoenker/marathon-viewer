export function v2length([x, y]) {
    return Math.sqrt(x * x + y * y);
}

export function v2scale(factor, [x, y]) {
    return [x * factor, y * factor];
}

export function v2normalize(v) {
    return v2scale(1 / v2length(v), v);
}

export function v2add([x1, y1], [x2, y2]) {
    return [x1 + x2, y1 + y2];
}

export function v2sub([x1, y1], [x2, y2]) {
    return [x1 - x2, y1 - y2];
}

export function v2dot([x1, y1], [x2, y2]) {
    return x1 * x2 + y1 * y2;
}

export function v2lerp(t, v1, v2) {
    return v2add(v2scale(1 - t, v1), v2scale(t, v2));
}

export function v2direction(radians) {
    return [Math.cos(radians), Math.sin(radians)];
}

export function isClockwise(v1, v2, v3) {
    const d1 = v2sub(v2, v1);
    const d2 = v2sub(v3, v2);
    return (d1[0] * d2[1]) - (d1[1] * d2[0]) > 0;
}
