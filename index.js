"use strict";

import { HtmlInputFile, HttpFile } from './files/binary-read.js';
import { Shapes } from './shapes-loader.js';
import { packColor, unpackColor, makeShadingTables, magenta, shadingTableForDistance } from './color.js';
import { drawOverhead } from './drawOverhead.js';
import {makeShapeDescriptor} from './files/shapes.js';
import {
    v2length,
    v2scale,
    v2normalize,
    v2add,
    v2sub,
    v2dot,
    v2lerp,
    v2direction,
    isClockwise
} from './vector.js';
import { v3scale, v3add } from './vector3.js';
import { World } from './world.js';
import {
    readMapSummaries,
    readMapFromSummary,
    readMapChunkTypes,
} from './files/wad.js';
import { ClipArea3d } from './clip.js';
import { Rasterizer } from './rasterize.js';
import { render } from './render.js';
import { Transformation } from './transform2d.js';
import { ScreenTransform } from './screen-transform.js';

let imageData = null;
let pixels = null;

function draw3d(canvas, player, world, shapes, seconds) {
    const context = canvas.getContext('2d');

    if (! imageData || imageData.width !== canvas.width || imageData.height !== canvas.height) {
        console.log('create imagedata');
        imageData = context.createImageData(canvas.width, canvas.height);
        pixels = new Uint32Array(imageData.data.buffer);
    }

    pixels.fill(magenta);
    
    const { points, lines, edges, polygons } = world;

    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);

    const frustumLeftDirection = v2scale(5, v2direction(player.facingAngle - player.hFov / 2));
    const frustumRightDirection = v2scale(5, v2direction(player.facingAngle + player.hFov / 2));

    const rasterizer = new Rasterizer(canvas.width, canvas.height, pixels, player);

    render({rasterizer, player, world, shapes, seconds});
    
    context.putImageData(imageData, 0, 0);
}

function update(player, world, actions, timeSlice, secondsElapsed) {
    let { position, height, polygon, facingAngle, hFov, vFov } = player;
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

    if (actions.has('stupid-mode')) {
        player.stupid_mode = ! player.stupid_mode;
    }

    [position, polygon] = world.movePlayer(oldPosition, position, polygon);

    return { ...player, position, height, polygon, facingAngle, hFov, vFov, secondsElapsed };
}

const keyMap = {
    'ArrowUp': 'forward',
    'ArrowDown': 'backward',
    'ArrowLeft': 'turn-left',
    'ArrowRight': 'turn-right',
    'z': 'strafe-left',
    'x': 'strafe-right',
    'd': 'up',
    'c': 'down',
    's': 'stupid-mode',
};

function initWorld(map, shapes, canvas, overheadCanvas, fpsCounter) {
    const hFov = 90 / 180 * Math.PI;
    
    const vFov = 2 * Math.atan(Math.tan(hFov / 2) * canvas.height / canvas.width);
    const world = new World(map);
    // const targetPolygon = 100;
    const targetPolygon = 1;

    const sum = map.polygons[targetPolygon].endpoints.reduce(
        (sum, pointIndex) => v2add(sum, map.points[pointIndex]),
        [0, 0],
    );
    const average = v2scale(1 / map.polygons[targetPolygon].endpoints.length / 1024, sum);

    let player = {
        position: average, // [2, 2],
        polygon: targetPolygon,
        facingAngle: 0.05,
        hFov,
        vFov,
        wallBitmapIndex: 31,
        height: map.polygons[targetPolygon].floorHeight / 1024 + 0.66,
        secondsElapsed: 0,
    };

    window.teleport = (polyIndex) => {
        const sum = map.polygons[polyIndex].endpoints.reduce(
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

    const actions = new Set();
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
            canvas.width, canvas.height, player.hFov, player.vFov);
        const viewRay = v3scale(100, screenTransform.screenToRay(e.offsetX, e.offsetY));
        const viewTransform = new Transformation(player.position, player.facingAngle);
        const worldEnd2d = viewTransform.unTransform([viewRay[0], viewRay[2]]);
        const ray = [worldEnd2d[0], worldEnd2d[1], player.height + viewRay[1]];
        const intercept = world.intersectLineSegment(
            player.polygon,
            [...player.position, player.height],
            ray,
        );

        if (intercept) {
            const polygon = world.polygons[intercept.polygonIndex];
            const shape = makeShapeDescriptor(0, 18, 5);
            if (intercept.type === 'floor') {
                polygon.floorTexture = shape;
            } else if (intercept.type === 'ceiling') {
                polygon.ceilingTexture = shape;
            } else if (intercept.type === 'wallPrimary') {
                const sideIndex = polygon.sides[intercept.wallIndex];
                if (Number.isInteger(sideIndex) && sideIndex >= 0) {
                    const side = world.sides[sideIndex];
                    side.primaryTexture.texture = shape;
                }
            } else if (intercept.type === 'wallSecondary') {
                const sideIndex = polygon.sides[intercept.wallIndex];
                if (Number.isInteger(sideIndex) && sideIndex >= 0) {
                    const side = world.sides[sideIndex];
                    side.secondaryTexture.texture = shape;
                }
            }
        }
    });

    const startTime = new Date();
    let fpsCounterBegin = new Date();
    let fpsCounted = 0;
    let lastFrameTime = null;
    let lastPoly = player.polygon;
    const frame = () => {
        if (! running) {
            return;
        }
        
        try {
            const frameTime = new Date();
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
                fpsCounterBegin = new Date();
                
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

function populateLevelSelect(levelSelect, summaries) {
    levelSelect.innerHtml = '';
    summaries.forEach((summary, i) => {
        if (summary && summary.info) {
            const option = document.createElement('option');
            option.value = `${i}`;
            option.innerText = summary.info.name;
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

window.addEventListener('load', async () => {
    const levelSelect = document.getElementById('levelSelect');
    const screenSizeSelect = document.getElementById('screenSizeSelect');
    const canvas = document.getElementById('world');
    const overheadCanvas = document.getElementById('overhead');
    const fpsCounter = document.getElementById('fpsCounter');

    const file = new HttpFile(mapUrl);
    const summaries = await readMapSummaries(file);

    populateLevelSelect(levelSelect, summaries);
    
    const summary = summaries[0];
    const map = await readMapFromSummary(summary);

    const shapes = new Shapes(new HttpFile(shapesUrl));
    
    let { cancel } = initWorld(map, shapes, canvas, overheadCanvas, fpsCounter);

    levelSelect.addEventListener('change', async (e) => {
        cancel();
        const level = parseInt(levelSelect.value);
        const summary = summaries[level];
        const map = await readMapFromSummary(summary);
        cancel = initWorld(map, shapes, canvas, overheadCanvas, fpsCounter).cancel;
    });

    const screenSizeChange = () => {
        const components = screenSizeSelect.value.split('x');
        if (components.length === 2) {
            canvas.width = components[0];
            canvas.height = components[1];
        }
    };
    
    screenSizeSelect.addEventListener('change', screenSizeChange);
    screenSizeChange();
});
