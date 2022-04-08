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

    // We set translation of canvas to chase the scroll region around
    const containerCenter = [
        (viewport.viewCenter[0] + 0x8000) / viewport.pixelSize,
        (viewport.viewCenter[1] + 0x8000) / viewport.pixelSize,
    ];

    const left = Math.max(0, containerCenter[0] - (viewport.width / 2));
    const top = Math.max(0, containerCenter[1] - (viewport.height / 2));

    return (
        <div style={{
            //position: 'relative',
            width: 0xffff / viewport.pixelSize,
            height: 0xffff / viewport.pixelSize,
        }}
        >
            <canvas width={viewport.width}
                height={viewport.height}
                style={{
                    //transform: `translate(${left}px, ${top}px)`,
                    position: 'sticky',
                    top: 0,
                    left: 0,
                }}
                data-left={left}
                data-top={top}
                ref={ref}>
            </canvas>
        </div>
    );
}
