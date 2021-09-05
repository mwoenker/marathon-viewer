export function v3length([x, y, z]) {
    return Math.sqrt(x * x + y * y + z * z);
}

export function v3scale(factor, [x, y, z]) {
    return [x * factor, y * factor, z * factor];
}

export function v3normalize(v) {
    return v3scale(1 / v3length(v), v);
}

export function v3add([x1, y1, z1], [x2, y2, z2]) {
    return [x1 + x2, y1 + y2, z1 + z2];
}

export function v3sub([x1, y1, z1], [x2, y2, z2]) {
    return [x1 - x2, y1 - y2, z1, - z2];
}

export function v3dot([x1, y1, z1], [x2, y2, z2]) {
    return x1 * x2 + y1 * y2 + z1 * z2;
}

export function v3lerp(t, v1, v2) {
    return v3add(v3scale(1 - t, v1), v3scale(t, v2));
}

