import { useRef, useLayoutEffect } from 'react';
import { MapGeometry } from '../../files/map';
import { Selection } from '../selection';
import { Viewport } from './viewport';
import { MapDraw } from './map-draw';

interface CanvasMapProps {
    map: MapGeometry | undefined,
    selection: Selection,
    viewport: Viewport
}

export function CanvasMap(allProps: CanvasMapProps): JSX.Element {
    const {
        map,
        selection,
        viewport,
    } = allProps;
    const ref = useRef<HTMLCanvasElement | null>(null);
    const frameRequest = useRef(0);

    const redraw = () => {
        if (ref.current) {
            const canvas = ref.current;
            const mapDraw = new MapDraw(map, selection, canvas, viewport);
            mapDraw.draw();
        }
        frameRequest.current = 0;
    };

    useLayoutEffect(
        () => {
            if (0 !== frameRequest.current) {
                cancelAnimationFrame(frameRequest.current);
            }
            frameRequest.current = requestAnimationFrame(redraw);
        }
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
