import { useRef, useEffect } from "preact/hooks";
import { useCallback } from "react";
import { Environment } from "../../environment";
import { MapGeometry } from "../../files/map";
import { MapInfo } from "../../files/map/map-info";
import { Shapes } from "../../shapes-loader";
import { UpdateState, VisualModeState } from "../state";

interface VisualModeProps {
    shapes: Shapes;
    map: MapGeometry;
    visualModeState: VisualModeState;
    updateState: UpdateState;
}

export function VisualMode({ shapes, map, visualModeState, updateState }: VisualModeProps): JSX.Element {
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

            environmentRef.current = new Environment(
                map,
                shapes,
                canvasRef.current,
                null,
                'software'
            );

            environmentRef.current.onMapChanged((map) => {
                updateState({ type: 'setMap', map });
            });

            environmentRef.current.start();
        } else {
            environmentRef.current && environmentRef.current.setMap(map);
            environmentRef.current && environmentRef.current.setShapes(shapes);
        }
    }, [map, shapes]);

    useEffect(() => {
        environmentRef.current &&
            environmentRef.current.setSelectedShape(visualModeState.selectedTexture);
    }, [visualModeState]);

    return (
        <canvas width={1024} height={768} ref={canvasRef} style={{ width: '100%', height: '100%' }}>
        </canvas>
    );
}
