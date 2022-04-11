import { useRef, useEffect } from "preact/hooks";
import { useCallback } from "react";
import { Environment } from "../../environment";
import { HttpFile } from "../../files/binary-read";
import { MapGeometry } from "../../files/map";
import { MapInfo } from "../../files/map/map-info";
import { Shapes } from "../../shapes-loader";

interface VisualModeProps {
    map: MapGeometry
}

const shapesUrl = 'minf.shpA';


export function VisualMode({ map }: VisualModeProps): JSX.Element {
    const environmentRef = useRef<Environment>();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mapInfoRef = useRef<MapInfo>();

    const resize = useCallback(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
        }
    }, []);

    useEffect(() => {
        window.addEventListener('resize', resize);

        return () => {
            window.removeEventListener('resize', resize);
            environmentRef.current && environmentRef.current.stop();
            environmentRef.current = undefined;
        };
    }, []);

    useEffect(() => {
        if (map.info !== mapInfoRef.current) {
            resize();
            mapInfoRef.current = map.info;
            environmentRef.current && environmentRef.current.stop();

            if (!canvasRef.current) {
                return;
            }

            const shapes = new Shapes(new HttpFile(shapesUrl));

            environmentRef.current = new Environment(
                map,
                shapes,
                canvasRef.current,
                null,
                'software'
            );
            environmentRef.current.start();
        } else {
            environmentRef.current && environmentRef.current.setMap(map);
        }
    }, [map]);

    return (
        <canvas width={1024} height={768} ref={canvasRef} style={{ width: '100%', height: '100%' }}>
        </canvas>
    );
}
