import { useRef, useEffect, useMemo } from "preact/hooks";
import { useCallback } from "react";
import { Environment } from "../../environment";
import { HttpFile } from "../../files/binary-read";
import { MapGeometry } from "../../files/map";
import { MapInfo } from "../../files/map/map-info";
import { Shapes } from "../../shapes-loader";

interface VisualModeProps {
    shapes: Shapes | null
    map: MapGeometry
}

const shapesUrl = 'minf.shpA';

export function VisualMode({ shapes: shapesProp, map }: VisualModeProps): JSX.Element {
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

    const shapes = useMemo(() => {
        if (!shapesProp) {
            return new Shapes(new HttpFile(shapesUrl));
        } else {
            return shapesProp;
        }
    }, [shapesProp]);

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
            environmentRef.current && environmentRef.current.setShapes(shapes);
        }
    }, [map, shapes]);

    return (
        <canvas width={1024} height={768} ref={canvasRef} style={{ width: '100%', height: '100%' }}>
        </canvas>
    );
}
