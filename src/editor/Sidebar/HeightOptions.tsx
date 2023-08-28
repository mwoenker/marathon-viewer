import { useCallback, useEffect, useMemo } from "react";
import { colorCodeForIndex, getCssColor } from "../../color";
import { MapGeometry } from "../../files/map";
import { formatWorldUnits, impossibleValue, toInternalUnits, } from "../../utils";
import { UpdateState } from "../state";
import { HeightModeState } from "../state/modes";

interface HeightProperties {
    index: number;
    height: number;
    selectedHeight: number | undefined;
    onSelect: (number: number) => void;
}

function Height({ index, height, selectedHeight, onSelect }: HeightProperties): JSX.Element {
    const cssClass = height === selectedHeight ? 'heightButton selected' : 'heightButton';
    const color = colorCodeForIndex(index);
    return (
        <div
            style={{ background: getCssColor(color) }}
            className={cssClass}
            onClick={() => onSelect(height)}>
            <div className="heightButtonInner">
                {formatWorldUnits(height)}
            </div>
        </div>
    );

}

interface HeightOptionsProps {
    map: MapGeometry;
    mode: HeightModeState;
    updateState: UpdateState;
}

const heightFormat = /^-?\d+(?:\.\d+)?$/;

export function HeightOptions({ map, mode, updateState }: HeightOptionsProps): JSX.Element {
    const heightsInMap = useMemo(() => {
        if (mode.type === 'floor_height') {
            return new Set(map?.getFloorHeights() ?? []);
        } else if (mode.type === 'ceiling_height') {
            return new Set(map?.getCeilingHeights() ?? []);
        } else {
            impossibleValue(mode.type);
        }
    }, [map, mode.type]);

    const selectHeight = useCallback((height: number) => {
        updateState({
            type: 'selectHeight',
            height
        });
    }, [updateState]);

    // remove any heights from the "new heights" set that are already in the map
    useEffect(() => {
        const deduplicated = new Set(mode.newHeights);
        for (const newHeight of mode.newHeights) {
            if (heightsInMap.has(newHeight)) {
                console.log('bonk', newHeight);
                deduplicated.delete(newHeight);
            }
        }
        if (deduplicated.size !== mode.newHeights.size) {
            updateState({
                type: 'setNewHeights',
                heights: deduplicated,
            });
        }
    }, [heightsInMap, mode.newHeights, updateState]);

    const addHeight = useCallback(() => {
        const input = window.prompt('Enter new height');
        if (input !== null && input.match(heightFormat)) {
            updateState({
                type: 'addNewHeight',
                height: toInternalUnits(parseFloat(input)),
            });
        }
    }, [updateState]);

    const editHeight = useCallback(() => {
        const oldHeight = mode.selectedHeight;
        if (typeof oldHeight !== 'number') {
            alert('No height selected');
        } else {
            const input = window.prompt('Enter new height');
            if (input !== null && input.match(heightFormat)) {
                const newHeight = toInternalUnits(parseFloat(input));
                updateState({
                    type: 'changeHeight',
                    oldHeight,
                    newHeight,
                });
            }
        }
    }, [mode.selectedHeight, updateState]);

    const heightsInOrder = useMemo(() => {
        const heights = new Set(heightsInMap);
        mode.newHeights.forEach(newHeight => heights.add(newHeight));
        return [...heights].sort((a, b) => a - b);
    }, [heightsInMap, mode.newHeights]);

    return (
        <div className="heightOptions">
            <div className="heightOptionsTopButtons">
                <button onClick={addHeight}>
                    Add
                </button>
                <button onClick={editHeight}>
                    Edit
                </button>
            </div>
            <div className="heights">
                {heightsInOrder.map((height, idx) => (
                    <Height
                        key={idx}
                        index={idx}
                        height={height}
                        selectedHeight={mode.selectedHeight}
                        onSelect={selectHeight} />
                ))}
            </div>
        </div>
    );
}
