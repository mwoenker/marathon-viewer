type Vec3 = [number, number, number]

export function v3length([x, y, z]: Vec3): number {
    return Math.sqrt(x * x + y * y + z * z);
}

export function v3scale(factor: number, [x, y, z]: Vec3): Vec3 {
    return [x * factor, y * factor, z * factor];
}

export function v3normalize(v: Vec3): Vec3 {
    return v3scale(1 / v3length(v), v);
}

export function v3add([x1, y1, z1]: Vec3, [x2, y2, z2]: Vec3): Vec3 {
    return [x1 + x2, y1 + y2, z1 + z2];
}

export function v3sub([x1, y1, z1]: Vec3, [x2, y2, z2]: Vec3): Vec3 {
    return [x1 - x2, y1 - y2, z1 - z2];
}

export function v3dot([x1, y1, z1]: Vec3, [x2, y2, z2]: Vec3): number {
    return x1 * x2 + y1 * y2 + z1 * z2;
}

export function v3lerp(t: number, v1: Vec3, v2: Vec3): Vec3 {
    return v3add(v3scale(1 - t, v1), v3scale(t, v2));
}

