import { MapGeometry } from "../../files/map";
import { impossibleValue } from "../../utils";
import { ModeState } from "./modes";

export function getMapHeights(map: MapGeometry, mode: ModeState): number[] {
    if (mode.type !== 'floor_height' && mode.type !== 'ceiling_height') {
        return [];
    }

    let heightsInMap: Set<number>;

    if (mode.type === 'floor_height') {
        heightsInMap = new Set(map?.getFloorHeights() ?? []);
    } else if (mode.type === 'ceiling_height') {
        heightsInMap = new Set(map?.getCeilingHeights() ?? []);
    } else {
        impossibleValue(mode.type);
    }

    const allHeights = new Set(heightsInMap);
    mode.newHeights.forEach(newHeight => allHeights.add(newHeight));
    const heightsInOrder = [...allHeights].sort((a, b) => a - b);

    return heightsInOrder;
}
