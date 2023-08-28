import { useRef, useLayoutEffect, useMemo, useCallback } from 'react';
import { MapGeometry } from '../../files/map';
import { Selection } from '../state';
import { Viewport } from './viewport';
import { MapDraw } from './map-draw';
import { DrawOperation } from '../state/drawOperation';
import { colorCodeForIndex, ColorComponents, polygonColor } from '../../color';
import { ModeState } from '../state/modes';
import { getMapHeights } from '../state/floorCeilingHeights';
interface CanvasMapProps {
    map: MapGeometry | undefined;
    mode: ModeState,
    selection: Selection;
    viewport: Viewport;
    drawOperation: DrawOperation | undefined;
}

function getHeightColors(heights: number[]) {
    const colorByHeight = new Map<number, ColorComponents>();

    if (heights) {
        heights.forEach((height, index) => {
            const color = colorCodeForIndex(index);
            colorByHeight.set(height, color);
        });
    }
    return colorByHeight;
}

export function CanvasMap(allProps: CanvasMapProps): JSX.Element {
    const {
        map,
        mode,
        selection,
        viewport,
        drawOperation,
    } = allProps;
    const ref = useRef<HTMLCanvasElement | null>(null);
    const frameRequest = useRef(0);

    const heights = useMemo(() =>
        map ? getMapHeights(map, mode) : [],
        [map, mode]);

    const heightColors = useMemo(() =>
        getHeightColors(heights),
        [heights]);

    const getPolygonColor = useCallback((polygonIndex): ColorComponents => {
        if (!map) {
            throw new Error('map doesn\'t exist!');
        }

        const polygon = map.getPolygon(polygonIndex);

        if (mode.type === 'geometry') {
            return polygonColor;
        } else {
            const color = heightColors.get(polygon.floorHeight);
            if (!color) {
                throw new Error(`no color for polygon ${polygonIndex}`);
            }
            return color;
        }
    }, [map, heightColors, mode.type]);

    const redraw = useCallback(() => {
        if (ref.current) {
            const canvas = ref.current;
            const mapDraw = new MapDraw(map, selection, canvas, viewport, drawOperation, getPolygonColor);
            mapDraw.draw();
        }
        frameRequest.current = 0;
    }, [drawOperation, getPolygonColor, map, selection, viewport]);

    useLayoutEffect(
        () => {
            if (0 !== frameRequest.current) {
                cancelAnimationFrame(frameRequest.current);
            }
            frameRequest.current = requestAnimationFrame(redraw);
        },
        [redraw]
    );

    return (
        <div style={{
            width: 0xffff / viewport.pixelSize,
            height: 0xffff / viewport.pixelSize,
        }}
        >
            <canvas width={viewport.width}
                height={viewport.height}
                style={{
                    position: 'sticky',
                    top: 0,
                    left: 0,
                }}
                ref={ref}>
            </canvas>
        </div>
    );
}
