export function lerp(t, a, b) {
    return (1 - t) * a + t * b;
}

export function floorMod(num, div) {
    const mod = num % div;
    return mod < 0 ? mod + div : mod;
}
