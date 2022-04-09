import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { MapGeometry } from "../../files/map";
import { closestLine, closestObject, closestPoint, polygonsAt } from '../../geometry';
import { v2dist, v2sub, v3tov2, Vec2 } from "../../vector2";
import { CanvasMap } from "../draw/canvas";
import { Viewport } from '../draw/viewport';
import { useSelectionState } from '../selection';

import type { JSXInternal } from 'preact/src/jsx';

interface MapViewProps {
    pixelSize: number,
    map: MapGeometry | undefined,
    onMapChange: (map: MapGeometry) => void
}

export function MapView({ pixelSize, map, onMapChange }: MapViewProps): JSX.Element {
    const [viewportSize, setViewportSize] = useState([0, 0]);
    const [viewCenter, setViewCenter] = useState([0, 0] as Vec2);
    const [selection, updateSelection] = useSelectionState();
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

        const distThreshold = pixelSize * 8;

        // Did we click on a point?
        const pointIndex = closestPoint(clickPos, map);
        const position = map.points[pointIndex];
        if (v2dist(position, clickPos) < distThreshold) {
            return updateSelection({
                type: 'down',
                objType: 'point',
                index: pointIndex,
                relativePos: v2sub(clickPos, position),
                coords: clickPos,
            });
        }

        // Did we click on an object?
        const objectIndex = closestObject(clickPos, map);
        const objectPosition = v3tov2(map.objects[objectIndex].position);
        if (v2dist(objectPosition, clickPos) < distThreshold) {
            return updateSelection({
                type: 'down',
                objType: 'object',
                index: objectIndex,
                relativePos: v2sub(clickPos, objectPosition),
                coords: clickPos,
            });
        }


        // Did we click on a line?
        const closest = closestLine(clickPos, map);
        if (closest && closest.distance < distThreshold) {
            const linePos = map.points[map.lines[closest.index].begin];
            return updateSelection({
                type: 'down',
                objType: 'line',
                index: closest.index,
                relativePos: v2sub(clickPos, linePos),
                coords: clickPos,
            });
        }

        // Did we click on a polygon?
        const polygons = polygonsAt(clickPos, map);
        if (polygons.length > 0) {
            const idx = polygons[polygons.length - 1];
            const poly = map.polygons[idx];
            // polygon "position" is position of first endpoint
            const polyPos = map.points[poly.endpoints[0]];
            return updateSelection({
                type: 'down',
                objType: 'polygon',
                index: idx,
                relativePos: v2sub(clickPos, polyPos),
                coords: clickPos,
            });
        }

        updateSelection({ type: 'cancel' });
    }

    function mouseMove(e: JSXInternal.TargetedMouseEvent<HTMLElement>) {
        const viewX = e.offsetX;
        const viewY = e.offsetY;

        updateSelection({
            type: 'move',
            coords: viewport.toWorld([viewX, viewY]),
            pixelSize: pixelSize,
        });
    }

    function mouseUp() {
        updateSelection({ type: 'up' });
    }

    function mouseLeave() {
        updateSelection({ type: 'up' });
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
                    onMapChange(newMap);
                    if (connectedPoints.length > 0) {
                        const oldIndex = connectedPoints[0];
                        const newIndex = newMap.points.findIndex(pt => pt === map.points[oldIndex]);
                        if (newIndex !== -1) {
                            updateSelection({
                                type: 'selectObject',
                                objType: 'point',
                                index: newIndex
                            });
                        }
                    } else {
                        updateSelection({ type: 'cancel' });
                    }
                } else if ('polygon' === selection.objType) {
                    onMapChange(map.deletePolygon(selection.index));
                    updateSelection({ type: 'cancel' });
                } else if ('line' === selection.objType) {
                    onMapChange(map.deleteLine(selection.index));
                    updateSelection({ type: 'cancel' });
                } else if ('object' === selection.objType) {
                    onMapChange(map.deleteObject(selection.index));
                    updateSelection({ type: 'cancel' });
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

    useEffect(
        () => {
            if (selection.isDragging && map) {
                if ('point' === selection.objType && selection.currentCoords) {
                    onMapChange(map.movePoint(
                        selection.index,
                        [
                            Math.floor(selection.currentCoords[0]),
                            Math.floor(selection.currentCoords[1])
                        ]
                    ));
                } else if ('polygon' === selection.objType && selection.currentCoords) {
                    onMapChange(map.movePolygon(
                        selection.index,
                        v2sub(
                            selection.currentCoords,
                            selection.relativePos)));
                } else if ('object' === selection.objType && selection.currentCoords) {
                    onMapChange(map.moveObject(
                        selection.index,
                        v2sub(
                            selection.currentCoords,
                            selection.relativePos)));
                }
            }
        },
        [selection.isDragging, selection.currentCoords]
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
