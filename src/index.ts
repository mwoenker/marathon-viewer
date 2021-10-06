"use strict";

import { HttpFile } from './files/binary-read';
import { Shapes } from './shapes-loader';
import { magenta } from './color';
import { drawOverhead } from './drawOverhead';
import { makeShapeDescriptor } from './files/shapes';
import { MapGeometry } from './files/map';
import { ObjectType } from './files/map/object';
import {
    Vec2,
    v2scale,
    v2add,
    v2direction,
} from './vector2';
import { Vec3 } from './vector3';
import { v3scale } from './vector3';
import { World, fromFixedAngle, fromMapCoords3d } from './world';
import {
    readMapSummaries,
    readMapFromSummary,
    MapSummary
} from './files/wad';
import { Rasterizer } from './rasterize';
import { render } from './render';
import { Transformation } from './transform2d';
import { ScreenTransform } from './screen-transform';

let imageData: ImageData | null = null;
let pixels: Uint32Array | null = null;

export interface Player {
    position: Vec2;
    polygon: number;
    facingAngle: number;
    verticalAngle: number;
    hFov: number;
    vFov: number;
    wallBitmapIndex: number;
    height: number;
    secondsElapsed: number,
}

interface ExtendedWindow extends Window {
    teleport(poly: number): void
}

declare const window: ExtendedWindow;

function draw3d(canvas: HTMLCanvasElement, player: Player, world: World, shapes: Shapes, seconds: number) {
    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error("Can't get context!");
    }

    if (!pixels || !imageData || imageData.width !== canvas.width || imageData.height !== canvas.height) {
        console.log('create imagedata');
        imageData = context.createImageData(canvas.width, canvas.height);
        if (!imageData) {
            throw new Error('createImageData failed')
        }
        pixels = new Uint32Array(imageData.data.buffer);
    }

    pixels.fill(magenta);

    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);

    const rasterizer = new Rasterizer(canvas.width, canvas.height, pixels, player);

    render({ rasterizer, player, world, shapes, seconds });

    context.putImageData(imageData, 0, 0);
}

function update(
    player: Player,
    world: World,
    actions: Set<string>,
    timeSlice: number,
    secondsElapsed: number) {
    let { position, height, polygon, facingAngle, verticalAngle } = player;
    const forward = v2direction(facingAngle);
    const left = v2direction(facingAngle - Math.PI / 2);
    const oldPosition = position;

    if (actions.has('forward')) {
        position = v2add(position, v2scale(timeSlice * 4, forward));
    }

    if (actions.has('backward')) {
        position = v2add(position, v2scale(-timeSlice * 4, forward));
    }

    if (actions.has('turn-left')) {
        facingAngle = facingAngle - timeSlice * 4;
    }

    if (actions.has('turn-right')) {
        facingAngle = facingAngle + timeSlice * 4;
    }

    if (actions.has('strafe-left')) {
        position = v2add(position, v2scale(timeSlice * 2, left));
    }

    if (actions.has('strafe-right')) {
        position = v2add(position, v2scale(-timeSlice * 2, left));
    }

    if (actions.has('up')) {
        height += timeSlice * 4;
    }

    if (actions.has('down')) {
        height -= timeSlice * 4;
    }

    if (actions.has('tilt-up')) {
        verticalAngle = Math.min(Math.PI / 6, verticalAngle + timeSlice * 2);
    }

    if (actions.has('tilt-down')) {
        verticalAngle = Math.max(-Math.PI / 6, verticalAngle - timeSlice * 2);
    }

    [position, polygon] = world.movePlayer(oldPosition, position, polygon);

    return { ...player, position, height, polygon, facingAngle, secondsElapsed, verticalAngle };
}

interface KeyMap {
    [key: string]: string;
}

const keyMap: KeyMap = {
    'ArrowUp': 'forward',
    'ArrowDown': 'backward',
    'ArrowLeft': 'turn-left',
    'ArrowRight': 'turn-right',
    'z': 'strafe-left',
    'x': 'strafe-right',
    'd': 'up',
    'c': 'down',
    'f': 'tilt-up',
    'v': 'tilt-down',
    's': 'stupid-mode',
};

function initWorld(
    map: MapGeometry,
    shapes: Shapes,
    canvas: HTMLCanvasElement,
    overheadCanvas: HTMLCanvasElement | null,
    fpsCounter: HTMLElement | null
) {
    const hFov = 90 / 180 * Math.PI;

    const vFov = 2 * Math.atan(Math.tan(hFov / 2) * canvas.height / canvas.width);
    let world = new World(map);
    // const targetPolygon = 100;
    let targetPolygon = 1;

    const zeroVec: Vec2 = [0, 0];
    const sum = map.polygons[targetPolygon].endpoints.reduce(
        (sum, pointIndex) => v2add(sum, map.points[pointIndex]),
        zeroVec,
    );
    let playerPosition = v2scale(1 / map.polygons[targetPolygon].endpoints.length / 1024, sum);
    let facingAngle = 0;
    let playerHeight = map.polygons[targetPolygon].floorHeight + 0.66

    for (const mapObject of map.objects) {
        if (mapObject.type === ObjectType.player) {
            targetPolygon = mapObject.polygon;
            const pos3d = fromMapCoords3d(mapObject.position);
            playerPosition = [pos3d[0], pos3d[1]];
            playerHeight = world.polygons[targetPolygon].floorHeight + pos3d[2] + 0.66;
            facingAngle = fromFixedAngle(mapObject.facing);
            break;
        }
    }

    let player = {
        position: playerPosition,
        polygon: targetPolygon,
        facingAngle: facingAngle,
        verticalAngle: 0.0,
        hFov,
        vFov,
        wallBitmapIndex: 31,
        height: playerHeight,
        secondsElapsed: 0,
    };

    window.teleport = (polyIndex) => {
        const sum: Vec2 = map.polygons[polyIndex].endpoints.reduce(
            (sum, pointIndex) => v2add(sum, map.points[pointIndex]),
            [0, 0],
        );
        const average = v2scale(1 / map.polygons[polyIndex].endpoints.length / 1024, sum);
        player.polygon = polyIndex;
        player.position = average,
            player.height = map.polygons[polyIndex].floorHeight / 1024 + 0.66;

        console.log(player.polygon, player.position, player.height);
    };

    let running = true;

    const actions = new Set<string>();
    window.addEventListener('keydown', (e) => {
        const action = keyMap[e.key];
        if (action) {
            e.preventDefault();
            actions.add(action);
        }
    });

    window.addEventListener('keyup', (e) => {
        const action = keyMap[e.key];
        if (action) {
            e.preventDefault();
            actions.delete(action);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            running = false;
        }
    });

    canvas.addEventListener('mousedown', (e) => {
        const screenTransform = new ScreenTransform(
            canvas.width, canvas.height, player.hFov, player.vFov, player.verticalAngle);
        const viewRay = v3scale(100, screenTransform.screenToRay(e.offsetX, e.offsetY));
        const viewTransform = new Transformation(player.position, player.facingAngle);
        const worldEnd2d = viewTransform.unTransform([viewRay[0], viewRay[2]]);
        const ray: Vec3 = [worldEnd2d[0], worldEnd2d[1], player.height + viewRay[1]];
        const intercept = world.intersectLineSegment(
            player.polygon,
            [...player.position, player.height],
            ray,
        );

        if (intercept) {
            const { polygonIndex } = intercept;
            const shape = makeShapeDescriptor(0, 18, 5);
            if (intercept.type === 'floor') {
                map = map.setFloorTexture({ polygonIndex, shape, offset: [0, 0] });
            } else if (intercept.type === 'ceiling') {
                map = map.setCeilingTexture({ polygonIndex, shape, offset: [0, 0] });
            } else if (intercept.type === 'wallPrimary') {
                const { polygonIndex, wallIndex, sideType } = intercept;
                map = map.setWallTexture({
                    polygonIndex,
                    wallIndex,
                    sideType,
                    textureSlot: 'primary',
                    shape,
                    offset: [0, 0],
                });
            } else if (intercept.type === 'wallSecondary') {
                const { polygonIndex, wallIndex, sideType } = intercept;
                map = map.setWallTexture({
                    polygonIndex,
                    wallIndex,
                    sideType,
                    textureSlot: 'secondary',
                    shape,
                    offset: [0, 0],
                });
            }

            world = new World(map);
        }
    });

    const startTime = (new Date()).getTime();
    let fpsCounterBegin = (new Date()).getTime();
    let fpsCounted = 0;
    let lastFrameTime = 0;
    let lastPoly = player.polygon;
    const frame = () => {
        if (!running) {
            return;
        }

        try {
            const frameTime = (new Date()).getTime();
            const timeSlice = (frameTime - lastFrameTime) / 1000;
            const secondsElapsed = (frameTime - startTime) / 1000;
            if (lastFrameTime) {
                player = update(player, world, actions, timeSlice, secondsElapsed);
                if (lastPoly !== player.polygon) {
                    console.log('poly', player.polygon);
                    lastPoly = player.polygon;
                }
            }

            if (canvas) {
                draw3d(canvas, player, world, shapes, secondsElapsed);
            }

            if (overheadCanvas) {
                drawOverhead(overheadCanvas, player, world);
            }

            ++fpsCounted;

            if (frameTime - fpsCounterBegin > 1000) {
                const secondsElapsed = (frameTime - fpsCounterBegin) / 1000;
                const fps = fpsCounted / secondsElapsed;
                fpsCounted = 0;
                fpsCounterBegin = (new Date()).getTime();

                if (fpsCounter) {
                    fpsCounter.innerText = `${fps} fps`;
                }
            }

            lastFrameTime = frameTime;
            requestAnimationFrame(frame);
            // setTimeout(frame, 0);
        } catch (e) {
            console.error(e);
        }
    };

    frame();

    const cancel = () => {
        console.log('cancel');
        running = false;
    };

    return { cancel };
}

function populateLevelSelect(levelSelect: HTMLSelectElement, summaries: MapSummary[]) {
    levelSelect.innerHTML = '';
    summaries.forEach((summary, i) => {
        console.log({ summary });
        console.log(summary.directoryEntry);
        if (summary && summary?.directoryEntry?.levelName) {
            const option = document.createElement('option');
            option.value = `${i}`;
            option.innerText = summary.directoryEntry.levelName;
            levelSelect.appendChild(option);
        }
    });
}

const shapesUrl = 'minf.shpA';
const mapUrl = 'minf.sceA';

// const shapesUrl = 'm2.shpA';
// const mapUrl = 'm2.sceA';

// const shapesUrl = 'Eternal-Shapes.shpA';
// const mapUrl = 'Eternal-Maps.sceA';

// const shapesUrl = 'Phoenix Shapes.shpA';
// const mapUrl = 'Phoenix Map.sceA';

// const shapesUrl = 'Megiddo Shapes.shpA';
// const mapUrl = 'Megiddo Map.sceA';

// const shapesUrl = 'Rubicon Shapes.shpA';
// const mapUrl = 'Rubicon Map.sceA';

interface Constructor { new(...args: unknown[]): unknown }

function elementById<T extends Constructor>(id: string, klass: T): InstanceType<T> | null {
    const element = document.getElementById(id);
    if (!element) {
        return null
    }
    if (element instanceof klass) {
        return element as InstanceType<T>;
    } else {
        throw new Error('dom node not instance of ${klass}')
    }
}

window.addEventListener('load', async () => {
    const levelSelect = elementById('levelSelect', HTMLSelectElement);
    const screenSizeSelect = elementById('screenSizeSelect', HTMLSelectElement);
    const canvas = elementById('world', HTMLCanvasElement)
    const overheadCanvas = elementById('overhead', HTMLCanvasElement);
    const fpsCounter = elementById('fpsCounter', HTMLElement);

    if (!canvas) {
        throw new Error('no canvas!')
    }

    const file = new HttpFile(mapUrl);
    const summaries = await readMapSummaries(file);

    const summary = summaries[0];
    const map = await readMapFromSummary(summary);

    const shapes = new Shapes(new HttpFile(shapesUrl));

    let { cancel } = initWorld(map, shapes, canvas, overheadCanvas, fpsCounter);

    if (levelSelect) {
        populateLevelSelect(levelSelect, summaries);
        levelSelect.addEventListener('change', async () => {
            cancel();
            const level = parseInt(levelSelect.value);
            const summary = summaries[level];
            const map = await readMapFromSummary(summary);
            cancel = initWorld(map, shapes, canvas, overheadCanvas, fpsCounter).cancel;
        });
    }

    const screenSizeChange = () => {
        if (screenSizeSelect) {
            const components = screenSizeSelect.value.split('x');
            if (components.length === 2) {
                canvas.width = parseInt(components[0]);
                canvas.height = parseInt(components[1]);
            }
        }
    };

    if (screenSizeSelect) {
        screenSizeSelect.addEventListener('change', screenSizeChange);
        screenSizeChange();
    }
});
