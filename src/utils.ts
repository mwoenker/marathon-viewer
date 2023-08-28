import { worldUnitSize } from "./constants";

export function lerp(t: number, a: number, b: number): number {
    return (1 - t) * a + t * b;
}

export function floorMod(num: number, div: number): number {
    const mod = num % div;
    return mod < 0 ? mod + div : mod;
}

export function clamp(num: number, low: number, high: number): number {
    return Math.min(high, Math.max(low, num));
}

export function impossibleValue(val: never): never {
    throw new Error(`impossible value: ${val}`);
}

export function toWorldUnits(internalUnits: number): number {
    return internalUnits / worldUnitSize;
}

export function toInternalUnits(worldUnits: number): number {
    return worldUnits * worldUnitSize;
}

export function formatWorldUnits(internalUnits: number): string {
    return toWorldUnits(internalUnits).toFixed(5);
}
