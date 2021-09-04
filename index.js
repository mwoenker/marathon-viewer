"use strict";

import { bitmaps, colorTable } from'./shapes-sewage.js';
import {
    vlength,
    vscale,
    vnormalize,
    vadd,
    vsub,
    vdot,
    vlerp,
    vdirection,
    isClockwise
} from './vector.js';
import { World } from './world.js';

const color32 = new Uint32Array(1);
const color8 = new Uint8Array(color32.buffer);

function packColor(r, g, b, a = 255) {
    color8[0] = parseInt(Math.max(0, Math.min(r, 255)));
    color8[1] = parseInt(Math.max(0, Math.min(g, 255)));
    color8[2] = parseInt(Math.max(0, Math.min(b, 255)));
    color8[3] = 255;
    return color32[0];
}

function unpackColor(val) {
    color32[0] = val;
    return [color8[0], color8[1], color8[2], color8[3]];
}

const nShadingLevels = 32;
const shadingLevels = new Array(nShadingLevels);
for (let i = 0; i < nShadingLevels; ++i) {
    shadingLevels[i] = colorTable.map(({r, g, b}) => {
        const brightness = i / (nShadingLevels - 1); 
        return packColor(
            r * brightness / 256,
            g * brightness / 256,
            b * brightness / 256,
        );
    });
}

const black = packColor(0, 0, 0);
const magenta = packColor(255, 0, 255);
const yellow = packColor(255, 255, 0);

function shadingTableForDistance(dist, brightness = 1) {
    const combined = brightness * (nShadingLevels - (dist * 2) - 1);
    return shadingLevels[parseInt(Math.max(0, Math.min(nShadingLevels - 1, combined)))];
}

function lerp(t, a, b) {
    return (1 - t) * a + t * b;
}

class Screen {
    constructor(width, height, pixels, player) {
        this.width = width;
        this.height = height;
        this.pixels = pixels;
        this.left = -Math.tan(player.hFov / 2);
        this.right = Math.tan(player.hFov / 2);
        this.top = Math.tan(player.vFov / 2);
        this.bottom = -Math.tan(player.vFov / 2);
        this.xScale = this.width / (this.right - this.left);
        this.yScale = this.height / (this.bottom - this.top);
    }

    viewXToColumn(x, z) {
        return this.xScale * (x / z - this.left);
    }
    
    viewYToRow(y, z) {
        const projected = y / z;
        return this.yScale * (projected - this.top);
    }
    
    drawWall({p1, p2, ceiling, floor, textureIndex, textureTop, textureBottom}) {
        let x1 = this.viewXToColumn(p1.position[0], p1.position[1]);
        let x2 = this.viewXToColumn(p2.position[0], p2.position[1]);
        if (x1 > x2) {
            [x1, x2] = [x2, x1];
            [p1, p2] = [p2, p1];
        }
        const z1 = p1.position[1];
        const z2 = p2.position[1];

        const startTop = this.viewYToRow(ceiling, z1);
        const startBottom = this.viewYToRow(floor, z1);
        const endTop = this.viewYToRow(ceiling, z2);
        const endBottom = this.viewYToRow(floor, z2);
        const texXOverZStart = p1.texX / z1;
        
        const topSlope = (endTop - startTop) / (x2 - x1);
        const bottomSlope = (endBottom - startBottom) / (x2 - x1);
        const zReciprocalStart = 1 / z1;
        const zReciprocalSlope = (1 / z2 - 1 / z1) / (x2 - x1);
        const texXOverZSlope = (p2.texX / z2 - p1.texX / z1) / (x2 - x1);

        const xStart = Math.max(0, Math.ceil(x1));
        const xEnd = Math.min(this.width, Math.ceil(x2));
        
        for (let x = xStart; x < xEnd; ++x) {
            const top = startTop + topSlope * (x - x1);
            const bottom = startBottom + bottomSlope * (x - x1);
            const zReciprocal = zReciprocalStart + zReciprocalSlope * (x - x1);
            const texXOverZ = texXOverZStart + texXOverZSlope * (x - x1);
            const z = 1 / zReciprocal;
            const shadingTable = shadingTableForDistance(z);
            this.drawWallSlice({
                x,
                top,
                bottom,
                colorTable: shadingTable,
                texXOffset: texXOverZ * z,
                texture: bitmaps[textureIndex],
                textureTop,
                textureBottom,
            });
        }
    }
    
    drawWallSlice({x, top, bottom, colorTable, texXOffset, texture, textureTop, textureBottom}) {
        const intTop = Math.max(0, parseInt(Math.ceil(top)));
        const intBottom = Math.min(this.height, parseInt(Math.ceil(bottom)));
        const texels = texture.data;
        
        let offset = x + this.width * intTop;
        const increment = this.width;
        const texelX = parseInt(texXOffset * texture.width) % texture.width;
        const texYMask = texture.height - 1;

        const rowBase = texelX * texture.width;
        const texelYSlope = (textureBottom - textureTop) * texture.height / (bottom - top);
        let texelY = textureTop * texture.height + (intTop - top) * texelYSlope;

        for (let y = intTop; y < intBottom; ++y) {
            const wrappedY = texelY & texYMask;
            const texel = texels[rowBase + wrappedY];
            const color = colorTable[texel];
            this.pixels[offset] = color;
            offset += increment;
            texelY += texelYSlope;
        }
    }
}

let imageData = null;
let pixels = null;
const ceilingHeight = 0.5;
const floorHeight = -0.5;

class Transformation {
    constructor(newOrigin, rotation) {
        this.newOrigin = newOrigin;
        this.xAxis = [-Math.sin(rotation), Math.cos(rotation)];
        this.yAxis = [Math.cos(rotation), Math.sin(rotation)];

        const m = -1;
        this.oldXAxis = [-Math.sin(rotation), Math.cos(rotation)];
        this.oldYAxis = [Math.cos(rotation), Math.sin(rotation)];
    }

    transform(v) {
        const translated = vsub(v, this.newOrigin);
        return [vdot(translated, this.xAxis), vdot(translated, this.yAxis)];
    }

    unTransform(v)  {
        const translated = [vdot(v, this.oldXAxis), vdot(v, this.oldYAxis)];
        return vadd(translated, this.newOrigin);
    }
}

class ClipArea {
    // p1 and p2 are points that lie on opposite bounding lines of view area
    // this.leftPlane and this.rightPlane define the bounding half spaces
    // vdot(this.leftPlane, p) > 0 and vdot(this.rightPlane, p) > 0
    constructor(p1, p2) {
        const p1Plane = [-p1[1], p1[0]];
        if (vdot(p1Plane, p2) > 0) {
            // line from origin to p2 defines the left edge of the area
            this.leftPlane = [p2[1], -p2[0]];
            this.rightPlane = p1Plane;
        } else {
            // line from origin to p1 defines left edge
            this.leftPlane = vscale(-1, p1Plane);
            this.rightPlane = [-p2[1], p2[0]];
        }
    }

    lerp(t, p1, p2) {
        return {
            position: vlerp(t, p1.position, p2.position),
            texX: lerp(t, p1.texX, p2.texX),
        };
    }

    clipLine(p1, p2) {
        const p1DotLeft = vdot(p1.position, this.leftPlane);
        const p2DotLeft = vdot(p2.position, this.leftPlane);

        if (p1DotLeft < 0 && p2DotLeft < 0) {
            return null;
        } else {
            if (p1DotLeft < 0) {
                const t = p1DotLeft / (p1DotLeft - p2DotLeft);
                p1 = this.lerp(t, p1, p2);
            } else if (p2DotLeft < 0) {
                const t = p2DotLeft / (p2DotLeft - p1DotLeft);
                p2 = this.lerp(t, p2, p1);
            }
        }
        
        const p1DotRight = vdot(p1.position, this.rightPlane);
        const p2DotRight = vdot(p2.position, this.rightPlane);

        if (p1DotRight < 0 && p2DotRight < 0) {
            return null;
        } else {
            if (p1DotRight < 0) {
                const t = p1DotRight / (p1DotRight - p2DotRight);
                p1 = this.lerp(t, p1, p2);
            } else if (p2DotRight < 0) {
                const t = p2DotRight / (p2DotRight - p1DotRight);
                p2 = this.lerp(t, p2, p1);
            }

            return [p1, p2];
        }
    }
}

function drawOverhead(canvas, player, world) {
    const top = -2;
    const left = -1;
    const right = 5;
    const bottom = 3;

    const { points, lines, edges, polygons } = world;

    const context = canvas.getContext('2d');
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);

    const angle = player.secondsElapsed * 10;
    const radians = angle * Math.PI / 180;
    
    const fromWorld = (vo) => {
        const toView = new Transformation(player.position, player.facingAngle);
        const v = toView.unTransform(toView.transform(vo));
        return [
            canvas.width * (v[0] - left) / (right - left),
            canvas.height * (v[1] - top) / (bottom - top),
        ];
    };

    const drawLines = (color, ...points) => {
        context.save();
        context.strokeStyle = color;
        context.beginPath();
        context.moveTo(...fromWorld(points[0]));
        for (let i = 1; i < points.length; ++i) {
            context.lineTo(...fromWorld(points[i]));
        }
        context.stroke();
        context.restore();
    };

    const frustumLeftDirection = vscale(5, vdirection(player.facingAngle - player.hFov / 2));
    const frustumRightDirection = vscale(5, vdirection(player.facingAngle + player.hFov / 2));

    drawLines('yellow', [-0.5, 0], [0.5, 0]);
    drawLines('yellow', [0, -0.5], [0, 0.5]);

    drawLines('green', player.position, vadd(player.position, frustumLeftDirection));
    drawLines('green', player.position, vadd(player.position, frustumRightDirection));

    const toView = new Transformation(player.position, player.facingAngle);

    const drawPolygon = (polygonIndex, clipArea) => {
        const polygon = polygons[polygonIndex];
        
        for (const edgeIndex of polygon.edges) {
            const edge = edges[edgeIndex];
            const [p1, p2] = world.getEdgeVertices(edge);

            if (! isClockwise(player.position, p1, p2)) {
                continue;
            }

            drawLines(polygon.color || 'purple', p1, p2);
            
            const p1View = {
                position: toView.transform(p1),
                texX: 0,
            };
            const p2View = {
                position: toView.transform(p2),
                texX: 1,
            };
                        
            const clippedLine = clipArea.clipLine(p1View, p2View);
            
            if (clippedLine) {
                if (edge.portalTo !== undefined && edge.portalTo !== null) {
                    const newClipArea = new ClipArea(clippedLine[0].position, clippedLine[1].position);
                    drawPolygon(edge.portalTo, newClipArea);
                    
                    context.save();
                    context.lineWidth = 3;
                    drawLines(
                        'cyan',
                        toView.unTransform(clippedLine[0].position),
                        toView.unTransform(clippedLine[1].position));
                    context.restore();

                } else {
                    context.save();
                    context.lineWidth = 3;
                    drawLines(
                        'red',
                        toView.unTransform(clippedLine[0].position),
                        toView.unTransform(clippedLine[1].position));
                    context.restore();
                }
            }
        }
    };

    const clipArea = new ClipArea(
        [-Math.tan(player.hFov / 2), 1],
        [Math.tan(player.hFov / 2), 1],
    );
    drawPolygon(player.polygon, clipArea);
}

function draw3d(canvas, player, world) {
    const context = canvas.getContext('2d');

    if (! imageData || imageData.width !== canvas.width || imageData.height !== canvas.height) {
        console.log('create imagedata');
        imageData = context.createImageData(canvas.width, canvas.height);
        pixels = new Uint32Array(imageData.data.buffer);
    }

    for (let i = 0; i < pixels.length; ++i) {
        pixels[i] = black;
    }
    
    const { points, lines, edges, polygons } = world;

    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);

    const frustumLeftDirection = vscale(5, vdirection(player.facingAngle - player.hFov / 2));
    const frustumRightDirection = vscale(5, vdirection(player.facingAngle + player.hFov / 2));

    const toView = new Transformation(player.position, player.facingAngle);
    const screen = new Screen(canvas.width, canvas.height, pixels, player);

    const drawPolygon = (polygonIndex, clipArea) => {
        const polygon = polygons[polygonIndex];
        
        for (const edgeIndex of polygon.edges) {
            const edge = edges[edgeIndex];
            const [p1, p2] = world.getEdgeVertices(edge);

            if (! isClockwise(player.position, p1, p2)) {
                continue;
            }

            const length = vlength(vsub(p1, p2));
            const p1View = {
                position: toView.transform(p1),
                texX: 0,
            };
            const p2View = {
                position: toView.transform(p2),
                texX: length,
            };
            
            const clippedLine = clipArea.clipLine(p1View, p2View);
            
            if (clippedLine) {
                if (edge.portalTo !== undefined && edge.portalTo !== null) {
                    const newClipArea = new ClipArea(clippedLine[0].position, clippedLine[1].position);
                    drawPolygon(edge.portalTo, newClipArea);
                } else {
                    screen.drawWall({
                        p1: clippedLine[0],
                        p2: clippedLine[1],
                        ceiling: polygon.top - player.height,
                        floor: polygon.bottom - player.height,
                        textureIndex: edge.texture,
                        textureTop: 0,
                        textureBottom: polygon.top - polygon.bottom
                    });
                }
            }
        }
    };

    const clipArea = new ClipArea(
        [-Math.tan(player.hFov / 2), 1],
        [Math.tan(player.hFov / 2), 1],
    );
    drawPolygon(player.polygon, clipArea);

    
    context.putImageData(imageData, 0, 0);
}

function update(player, world, actions, timeSlice, secondsElapsed) {
    let { position, polygon, facingAngle, hFov, vFov } = player;
    const forward = vdirection(facingAngle);
    const left = vdirection(facingAngle - Math.PI / 2);
    const oldPosition = position;
    
    if (actions.has('forward')) {
        position = vadd(position, vscale(timeSlice * 4, forward));
    }

    if (actions.has('backward')) {
        position = vadd(position, vscale(-timeSlice * 4, forward));
    }

    if (actions.has('turn-left')) {
        facingAngle = facingAngle - timeSlice * 2;
    }
    
    if (actions.has('turn-right')) {
        facingAngle = facingAngle + timeSlice * 2;
    }
    
    if (actions.has('strafe-left')) {
        position = vadd(position, vscale(timeSlice * 4, left));
    }
    
    if (actions.has('strafe-right')) {
        position = vadd(position, vscale(-timeSlice * 4, left));
    }

    [position, polygon] = world.movePlayer(oldPosition, position, polygon);

    return { ...player, position, polygon, facingAngle, hFov, vFov, secondsElapsed };
}

const keyMap = {
    'ArrowUp': 'forward',
    'ArrowDown': 'backward',
    'ArrowLeft': 'turn-left',
    'ArrowRight': 'turn-right',
    'z': 'strafe-left',
    'x': 'strafe-right',
};

function initWorld(canvas, overheadCanvas, fpsCounter) {
    const hFov = Math.PI / 2;
    const vFov = 2 * Math.atan(Math.tan(hFov / 2) * canvas.height / canvas.width);
    const world = new World();

    let player = {
        position: [1, 1],
        polygon: 0,
        facingAngle: 0.05,
        hFov,
        vFov,
        wallBitmapIndex: 31,
        height: 0.5,
        ceilingBitmapIndex: 5,
        floorBitmapIndex: 28,
        secondsElapsed: 0,
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
        } else if (e.key === 'c') {
            e.preventDefault();
            player.wallBitmapIndex = (player.wallBitmapIndex + 1) % bitmaps.length;
            console.log('wall bitmap', player.wallBitmapIndex);
        } else if (e.key === 'v') {
            e.preventDefault();
            player.floorBitmapIndex = (player.floorBitmapIndex + 1) % bitmaps.length;
            console.log('floor bitmap', player.floorBitmapIndex);
        } else if (e.key === 'b') {
            e.preventDefault();
            player.ceilingBitmapIndex = (player.ceilingBitmapIndex + 1) % bitmaps.length;
            console.log('ceiling bitmap', player.ceilingBitmapIndex);
        }
    });

    const startTime = new Date();
    let fpsCounterBegin = new Date();
    let fpsCounted = 0;
    let lastFrameTime = null;
    const frame = () => {
        try {
            const frameTime = new Date();
            if (lastFrameTime) {
                const timeSlice = (frameTime - lastFrameTime) / 1000;
                const secondsElapsed = (frameTime - startTime) / 1000;
                player = update(player, world, actions, timeSlice, secondsElapsed);
            }

            if (canvas) {
                draw3d(canvas, player, world);
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
            if (running) {
                requestAnimationFrame(frame);
            }
        } catch (e) {
            console.error(e);
        }
    };

    frame();
}

window.addEventListener('load', () => {
    const canvas = document.getElementById('world');
    const overheadCanvas = document.getElementById('overhead');
    const fpsCounter = document.getElementById('fpsCounter');
    initWorld(canvas, overheadCanvas, fpsCounter);
});

