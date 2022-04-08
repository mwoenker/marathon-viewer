import { Vec3 } from './vector3';

export type Vec2 = [number, number]

export function v2(x: number, y: number): Vec2 {
    return [x, y];
}

export function v3tov2(v3: Vec3): Vec2 {
    return [v3[0], v3[1]];
}

export function v2length([x, y]: Vec2): number {
    return Math.sqrt(x * x + y * y);
}

export function v2scale(factor: number, [x, y]: Vec2): Vec2 {
    return [x * factor, y * factor];
}

export function v2normalize(v: Vec2): Vec2 {
    return v2scale(1 / v2length(v), v);
}

export function v2add([x1, y1]: Vec2, [x2, y2]: Vec2): Vec2 {
    return [x1 + x2, y1 + y2];
}

export function v2sub([x1, y1]: Vec2, [x2, y2]: Vec2): Vec2 {
    return [x1 - x2, y1 - y2];
}

export function v2dot([x1, y1]: Vec2, [x2, y2]: Vec2): number {
    return x1 * x2 + y1 * y2;
}

export function v2lerp(t: number, v1: Vec2, v2: Vec2): Vec2 {
    return v2add(v2scale(1 - t, v1), v2scale(t, v2));
}

export function v2direction(radians: number): Vec2 {
    return [Math.cos(radians), Math.sin(radians)];
}

export function v2lengthSquared(v: Vec2): number {
    return (v[0] * v[0]) + (v[1] * v[1]);
}

export function v2distSquared(a: Vec2, b: Vec2): number {
    return v2lengthSquared(v2sub(a, b));
}

export function v2dist(a: Vec2, b: Vec2): number {
    return v2length(v2sub(a, b));
}

export function isClockwise(v1: Vec2, v2: Vec2, v3: Vec2): boolean {
    const d1 = v2sub(v2, v1);
    const d2 = v2sub(v3, v2);
    return (d1[0] * d2[1]) - (d1[1] * d2[0]) > 0;
}
