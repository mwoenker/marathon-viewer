import { useState, useRef, useLayoutEffect } from 'react';
import { MapGeometry } from "../../files/map";
import { Vec2 } from "../../vector2";
import { CanvasMap } from "../draw/canvas";
import { Viewport } from '../draw/viewport';
import { Action, Selection } from '../state';

import type { JSXInternal } from 'preact/src/jsx';

interface MapViewProps {
    pixelSize: number,
    map: MapGeometry | undefined,
    selection: Selection,
    updateState: (action: Action) => void
}

export function MapView({
    pixelSize,
    map,
    selection,
    updateState
}: MapViewProps): JSX.Element {
    const [viewportSize, setViewportSize] = useState([0, 0]);
    const [viewCenter, setViewCenter] = useState([0, 0] as Vec2);
    const ref = useRef<HTMLDivElement>(null);
    const viewport = new Viewport(
        viewportSize[0], viewportSize[1], pixelSize, viewCenter);

    function toPixel(coord: Vec2) {
        return coord.map(e => (e + 0x7fff) / pixelSize);
    }

    function mouseDown(e: MouseEvent) {
        if (!map) {
            return;
        }

        const clickPos = viewport.toWorld([
            e.offsetX,
            e.offsetY
        ]);

        return updateState({
            type: 'mapMouseDown',
            coords: clickPos
        });
    }

    function mouseMove(e: JSXInternal.TargetedMouseEvent<HTMLElement>) {
        const viewX = e.offsetX;
        const viewY = e.offsetY;

        updateState({
            type: 'mapMouseMove',
            coords: viewport.toWorld([viewX, viewY]),
            pixelSize: pixelSize,
        });
    }

    function mouseUp() {
        updateState({ type: 'mapMouseUp' });
    }

    function mouseLeave() {
        updateState({ type: 'mapMouseUp' });
    }

    function changeMap(map: MapGeometry, isEphemeral = false) {
        updateState({ type: 'setMap', map, isEphemeral });
    }

    function keyDown(e: JSXInternal.TargetedKeyboardEvent<HTMLElement>) {
        if (!map) {
            return;
        }
        switch (e.key) {
            case 'Backspace':
            case 'Delete':
                if ('point' === selection.objType) {
                    const connectedPoints = map.getConnectedPoints(selection.index);
                    const newMap = map.deletePoint(selection.index);
                    changeMap(newMap);
                    if (connectedPoints.length > 0) {
                        const oldIndex = connectedPoints[0];
                        const newIndex = newMap.points.findIndex(pt => pt === map.points[oldIndex]);
                        if (newIndex !== -1) {
                            updateState({
                                type: 'selectObject',
                                objType: 'point',
                                index: newIndex
                            });
                        }
                    } else {
                        updateState({ type: 'cancel' });
                    }
                } else if ('polygon' === selection.objType) {
                    changeMap(map.deletePolygon(selection.index));
                    updateState({ type: 'cancel' });
                } else if ('line' === selection.objType) {
                    changeMap(map.deleteLine(selection.index));
                    updateState({ type: 'cancel' });
                } else if ('object' === selection.objType) {
                    changeMap(map.deleteObject(selection.index));
                    updateState({ type: 'cancel' });
                }
                break;
        }
    }

    function updateScroll() {
        if (ref.current) {
            const centerPixel = [
                ref.current.scrollLeft + (ref.current.clientWidth / 2),
                ref.current.scrollTop + (ref.current.clientHeight / 2)];
            const centerWorld = centerPixel.map(e => e * pixelSize - 0x7fff) as Vec2;
            setViewCenter(centerWorld);
        }
    }

    function recenterView() {
        if (ref.current) {
            const pixelCenter = toPixel(viewCenter);
            const pixelCorner = [
                pixelCenter[0] - (ref.current.clientWidth / 2),
                pixelCenter[1] - (ref.current.clientHeight / 2)
            ];
            ref.current.scrollTo(pixelCorner[0], pixelCorner[1]);
            if (viewportSize[0] != ref.current.clientWidth ||
                viewportSize[1] != ref.current.clientHeight) {
                setViewportSize(
                    [ref.current.clientWidth, ref.current.clientHeight]);
            }
        }
    }

    useLayoutEffect(
        // Keep view centered on viewCenter whenever we render or window is
        // resized.
        () => {
            recenterView();
            window.addEventListener('resize', recenterView);
            return () => window.removeEventListener('resize', recenterView);
        },
    );

    return (
        <div className='mapView'
            tabIndex={0}
            onScroll={updateScroll}
            onMouseDown={mouseDown}
            onMouseMove={mouseMove}
            onMouseUp={mouseUp}
            onMouseLeave={mouseLeave}
            onKeyDown={keyDown}
            ref={ref}
        >
            <CanvasMap
                map={map}
                selection={selection}
                viewport={viewport}
            />
        </div>
    );
}
