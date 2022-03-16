export function lerp(t: number, a: number, b: number): number {
    return (1 - t) * a + t * b;
}

export function floorMod(num: number, div: number): number {
    const mod = num % div;
    return mod < 0 ? mod + div : mod;
}

export function impossibleValue(val: never): never {
    throw new Error(`impossible value: ${val}`);
}

