import { floorMod } from "../../utils";
import { Vec2 } from "../../vector2";

export const snapGridSettings = [
    {
        size: 0,
        label: 'None',
    },
    {
        size: 1024,
        label: '1 WU',
    },
    {
        size: 512,
        label: '1/2 WU',
    },
    {
        size: 256,
        label: '1/4 WU',
    },
    {
        size: 128,
        label: '1/8 WU',
    }
] as const;

export const snapGridSizes = snapGridSettings.map(x => x.size);

export type SnapGridSize = typeof snapGridSizes[number];

export function snapToGrid(gridSize: SnapGridSize, position: Vec2): Vec2 {
    if (gridSize === 0) {
        return [Math.floor(position[0]), Math.floor(position[1])];
    }
    const x = position[0] + gridSize / 2;
    const y = position[1] + gridSize / 2;
    return [
        x - floorMod(x, gridSize),
        y - floorMod(y, gridSize),
    ];
}
