import { MapGeometry } from "../../../files/map";
import { CollectionWithShading, Shapes } from "../../../shapes-loader";
import { Collections, CollectionNames, makeShapeDescriptor, parseShapeDescriptor } from '../../../files/shapes';
import { fullBrightShadingTable } from '../../../color';
import { useEffect, useState } from "preact/hooks";
import { Shape } from "./Shape";
import { Action, VisualModeState } from "../../state";
import { useMemo } from "react";

export interface VisualOptionsProps {
    visualModeState: VisualModeState;
    updateState: (action: Action) => void;
    shapes: Shapes;
    map: MapGeometry;
}

function useShapesCollection(shapes: Shapes, collectionId: number) {
    const [collection, setCollection] = useState(shapes.getCollection(collectionId));

    useEffect(() => {
        setCollection(shapes.getCollection(collectionId));

        const listener = (idx: number, collection: CollectionWithShading) => {
            if (idx === collectionId) {
                setCollection(collection);
            }
        };

        shapes.addLoadListener(listener);

        return () => {
            shapes.removeLoadListener(listener);
        };
    }, [shapes, collectionId]);

    return collection;
}

export function VisualOptions({ visualModeState, updateState, shapes, map }: VisualOptionsProps): JSX.Element {
    const [collectionId, setCollectionId] = useState(Collections.wallsWater);
    const collection = useShapesCollection(shapes, collectionId);

    const lightIndexes = useMemo(() => {
        return map.lights.map((_, index) => index);
    }, [map.lights]);

    useEffect(() => {
        updateState({ type: 'selectTexture', texture: undefined });
    }, [collection]);

    const collectionIds: Collections[] = [];
    Object.values(Collections).forEach(val => {
        if (typeof val === 'number') {
            collectionIds.push(val);
        }
    });

    const fullbrightTable = collection ?
        fullBrightShadingTable(collection.clutShadingTables[0].normal)
        : null;

    const selectLight = (optionValue: string) => {
        const light = optionValue === '' ? undefined : parseInt(optionValue);
        updateState({ type: 'selectLight', light });
    };

    return <div className="contextPanel">
        <select
            value={collectionId}
            onChange={e => setCollectionId(Number(e.currentTarget.value))}
        >
            {collectionIds.map(id => (
                <option value={id} key={id}>{CollectionNames[id]}</option>
            ))}
        </select>
        <select
            value={visualModeState.selectedLight}
            onChange={e => selectLight(e.currentTarget.value)}
        >
            <option value=''>Don&apos;t change light</option>
            {lightIndexes.map(lightIndex => (
                <option key={lightIndex} value={lightIndex}>Light {lightIndex}</option>
            ))}
        </select>
        <div className="texturePalette">
            {collection?.bitmaps.map((bitmap, index) => {
                const descriptor = makeShapeDescriptor(collectionId, 0, index);
                return (
                    <Shape
                        bitmap={bitmap}
                        colorTable={fullbrightTable}
                        selected={descriptor === visualModeState.selectedTexture}
                        onClick={() => updateState({
                            type: 'selectTexture',
                            texture: descriptor
                        })}
                    />
                );
            })}
        </div>
    </div>;
}
