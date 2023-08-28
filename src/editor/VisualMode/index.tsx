import { useRef, useEffect } from "preact/hooks";
import { useCallback } from "react";
import { Environment } from "../../environment";
import { MapGeometry } from "../../files/map";
import { MapInfo } from "../../files/map/map-info";
import { TransferMode } from "../../files/wad";
import { Shapes } from "../../shapes-loader";
import { getConnectedSurfaces, Surface, TexturedSurface } from "../../surface";
import { UpdateState, VisualModeState } from "../state";
import { Vec2, v2sub, v2add } from "../vector2";

interface VisualModeProps {
    shapes: Shapes;
    map: MapGeometry;
    visualModeState: VisualModeState;
    updateState: UpdateState;
}

interface DragState {
    lastPos: Vec2;
    surfaces: TexturedSurface[]
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
                'webgl2'
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

    const dragState = useRef<null | DragState>(null);

    const mouseDown = useCallback((e: MouseEvent) => {
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
                const textureInfo = map.getSurfaceInfo(intercept);
                surfaces = [{ texOffset: textureInfo?.texCoords ?? [0, 0], surface: intercept }];
            }

            dragState.current = {
                lastPos: [e.offsetX, e.offsetY],
                surfaces
            };

            let newMap = map;

            for (const connectedSurface of surfaces) {
                const { surface, texOffset } = connectedSurface;
                const surfaceInfo = newMap.getSurfaceInfo(surface);
                const existingLight = surfaceInfo?.light ?? 0;
                const selectedLight = visualModeState.selectedLight;
                const light = typeof selectedLight === 'number'
                    ? selectedLight
                    : existingLight;
                newMap = newMap.setSurfaceTextureInfo(surface, {
                    texCoords: texOffset,
                    shape: visualModeState.selectedTexture,
                    light,
                    transferMode: TransferMode.normal
                });
            }

            updateState({ type: 'setMap', map: newMap });
        }
    }, [map, updateState, visualModeState.selectedTexture, visualModeState.selectedLight]);

    const mouseUp = useCallback(() => {
        dragState.current = null;
    }, []);

    const mouseMove = useCallback((e: MouseEvent) => {
        if (environmentRef.current && visualModeState.selectedTexture) {
            if (dragState.current) {
                const pos: Vec2 = [e.offsetX, e.offsetY];
                const delta = v2sub(pos, dragState.current.lastPos);

                const surfaces = dragState.current.surfaces.map(surf => {
                    return {
                        ...surf,
                        texOffset: v2sub(surf.texOffset, delta)
                    };
                });

                dragState.current = {
                    lastPos: pos,
                    surfaces
                };

                let newMap = map;

                for (const connectedSurface of surfaces) {
                    const { surface, texOffset } = connectedSurface;
                    const surfaceInfo = newMap.getSurfaceInfo(surface);
                    const light = surfaceInfo?.light ?? 0;
                    newMap = newMap.setSurfaceTextureInfo(surface, {
                        texCoords: texOffset,
                        shape: visualModeState.selectedTexture,
                        light: light,
                        transferMode: TransferMode.normal
                    });
                }

                updateState({ type: 'setMap', map: newMap });

            } else {
                const x = e.offsetX;
                const y = e.offsetY;

                environmentRef.current.setMousePosition([x, y]);
            }
        }
    }, [map, updateState, visualModeState.selectedTexture]);

    const mouseLeave = useCallback(() => {
        dragState.current = null;
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
            onMouseDown={mouseDown}
            onMouseUp={mouseUp}
            onMouseMove={mouseMove}
            onMouseLeave={mouseLeave}
        >
        </canvas>
    );
}
