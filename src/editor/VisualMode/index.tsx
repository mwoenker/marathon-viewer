import { useRef, useEffect } from "preact/hooks";
import { useCallback } from "react";
import { Environment } from "../../environment";
import { MapGeometry } from "../../files/map";
import { MapInfo } from "../../files/map/map-info";
import { TransferMode } from "../../files/wad";
import { Shapes } from "../../shapes-loader";
import { getConnectedSurfaces, Surface, TexturedSurface } from "../../surface";
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
        };
    }, [resize]);

    useEffect(() => {
        return () => {
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
    }, [map, shapes, resize, updateState]);

    useEffect(() => {
        environmentRef.current &&
            environmentRef.current.setSelectedShape(visualModeState.selectedTexture);
    }, [visualModeState]);

    const click = useCallback((e: MouseEvent) => {
        if (environmentRef.current && visualModeState.selectedTexture) {
            const x = e.offsetX;
            const y = e.offsetY;
            const flood = e.shiftKey;

            const intercept = environmentRef.current.getSurfaceAt(x, y);
            if (!intercept) {
                return map;
            }

            const clickedInfo = map.getSurfaceInfo(intercept);

            if (!clickedInfo) {
                return;
            }

            let surfaces: TexturedSurface[];

            if (flood) {
                surfaces = getConnectedSurfaces(map, intercept, (surface) => {
                    const info = map.getSurfaceInfo(surface);
                    return info !== null && info.shape === clickedInfo.shape;
                });
            } else {
                surfaces = [{ texOffset: [0, 0], surface: intercept }];
            }

            let newMap = map;

            for (const connectedSurface of surfaces) {
                const { surface, texOffset } = connectedSurface;
                newMap = newMap.setSurfaceTextureInfo(surface, {
                    texCoords: texOffset,
                    shape: visualModeState.selectedTexture,
                    light: 0,
                    transferMode: TransferMode.normal
                });
            }

            updateState({ type: 'setMap', map: newMap });
        }
    }, [map, updateState, visualModeState.selectedTexture]);

    const mouseMove = useCallback((e: MouseEvent) => {
        if (environmentRef.current) {
            const x = e.offsetX;
            const y = e.offsetY;

            environmentRef.current.setMousePosition([x, y]);
        }
    }, []);

    const mouseLeave = useCallback(() => {
        console.log('leave');
        if (environmentRef.current) {
            environmentRef.current.setMousePosition(undefined);
        }
    }, []);

    useEffect(() => {
        const keyUp = (e: KeyboardEvent) => {
            if (e.key === 'Shift') {
                environmentRef.current?.setShouldFloodSelection(false);
            }
        };

        const keyDown = (e: KeyboardEvent) => {
            if (e.key === 'Shift') {
                environmentRef.current?.setShouldFloodSelection(true);
            }
        };

        window.addEventListener('keyup', keyUp);
        window.addEventListener('keydown', keyDown);

        return () => {
            window.removeEventListener('keyup', keyUp);
            window.removeEventListener('keydown', keyDown);
        };
    }, [mouseLeave]);

    return (
        <canvas
            width={1024}
            height={768}
            ref={canvasRef}
            style={{ width: '100%', height: '100%' }}
            onClick={click}
            onMouseMove={mouseMove}
            onMouseLeave={mouseLeave}
        >
        </canvas>
    );
}
