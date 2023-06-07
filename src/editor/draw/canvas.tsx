import { useRef, useLayoutEffect } from 'react';
import { MapGeometry } from '../../files/map';
import { Selection } from '../state';
import { Viewport } from './viewport';
import { MapDraw } from './map-draw';
import { DrawOperation } from '../state/drawOperation';

interface CanvasMapProps {
    map: MapGeometry | undefined,
    selection: Selection,
    viewport: Viewport,
    drawOperation: DrawOperation | undefined
}

export function CanvasMap(allProps: CanvasMapProps): JSX.Element {
    const {
        map,
        selection,
        viewport,
        drawOperation
    } = allProps;
    const ref = useRef<HTMLCanvasElement | null>(null);
    const frameRequest = useRef(0);
    console.log({ drawOperation });
    const redraw = () => {
        if (ref.current) {
            const canvas = ref.current;
            const mapDraw = new MapDraw(map, selection, canvas, viewport, drawOperation);
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
