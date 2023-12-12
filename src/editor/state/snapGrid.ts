import { worldUnitSize } from "../../constants";
import { floorMod } from "../../utils";
import { Vec2 } from "../../vector2";

export const snapGridSettings = [
    {
        size: 0,
        label: 'None',
    },
    {
        size: worldUnitSize,
        label: '1 WU',
    },
    {
        size: worldUnitSize / 2,
        label: '1/2 WU',
    },
    {
        size: worldUnitSize / 4,
        label: '1/4 WU',
    },
    {
        size: worldUnitSize / 8,
        label: '1/8 WU',
    }
] as const;

export const snapGridSizes = snapGridSettings.map(x => x.size);

export const defaultSnapGridSize = worldUnitSize / 8;

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
