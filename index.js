"use strict";

import { bitmaps, colorTable } from'./shapes-lava-inf.js';
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
import { World } from './world.js';
import { ClipArea, ClipArea3d } from './clip.js';
import {lerp} from './utils.js';

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

        this.topParamList = new Array(width);
        this.bottomParamList = new Array(width);
        
        for (let i = 0; i < width; ++i) {
            this.topParamList[i] = {
                y: 0,
                oneOverZ: 0,
                textureX: 0,
                textureY: 0,
            };
            this.bottomParamList[i] = {
                y: 0,
                oneOverZ: 0,
                textureXOverZ: 0,
                textureYOverZ: 0,
            };
        }
        
        this.leftParamList = new Array(height);
        this.rightParamList = new Array(height);
        
        for (let i = 0; i < height; ++i) {
            this.leftParamList[i] = {
                x: 0,
                oneOverZ: 0,
                textureX: 0,
                textureY: 0,
            };
            this.rightParamList[i] = {
                x: 0,
                oneOverZ: 0,
                textureXOverZ: 0,
                textureYOverZ: 0,
            };
        }
    }

    viewXToColumn(x, z) {
        return this.xScale * (x / z - this.left);
    }
    
    viewYToRow(y, z) {
        const projected = y / z;
        return this.yScale * (projected - this.top);
    }

    calcLineTextureParams(leftVertex, rightVertex, leftTexCoord, rightTexCoord, params) {
        const yStart = leftVertex[1];
        const yEnd = rightVertex[1];
        
        const oneOverZStart = 1 / leftVertex[2];
        const oneOverZEnd = 1 / rightVertex[2];
        const texXOverZStart = leftTexCoord[0] * oneOverZStart;
        const texXOverZEnd = rightTexCoord[0] * oneOverZEnd;
        const texYOverZStart = leftTexCoord[1] * oneOverZStart;
        const texYOverZEnd = rightTexCoord[1] * oneOverZEnd;

        const xDiff = rightVertex[0] - leftVertex[0];
        const xMin = Math.max(0, Math.ceil(leftVertex[0]));
        const xMax = Math.min(this.width, Math.ceil(rightVertex[0]));

        for (let x = xMin; x < xMax; ++x) {
            const t = (x - leftVertex[0]) / xDiff;
            params[x].y = lerp(t, yStart, yEnd);
            params[x].oneOverZ = lerp(t, oneOverZStart, oneOverZEnd);
            params[x].textureXOverZ = lerp(t, texXOverZStart, texXOverZEnd);
            params[x].textureYOverZ = lerp(t, texYOverZStart, texYOverZEnd);
        }
    }

    drawWall({polygon, textureIndex}) {
        const screenPosition = polygon.map(({position}) => [
            this.viewXToColumn(position[0], position[2]),
            this.viewYToRow(position[1], position[2]),
            position[2],
        ]);
        let left = this.width;
        let right = 0;
        for (let i = 0; i < polygon.length; ++i) {
            const nextI = (i + 1) % polygon.length;
            const position = screenPosition[i];
            const nextPosition = screenPosition[nextI];
            if (nextPosition[0] > position[0]) {
                // top of polygon
                this.calcLineTextureParams(
                    position,
                    nextPosition,
                    polygon[i].texCoord,
                    polygon[nextI].texCoord,
                    this.topParamList);
            } else if (nextPosition[0] < position[0]) {
                // bottom of polygon
                this.calcLineTextureParams(
                    nextPosition,
                    position,
                    polygon[nextI].texCoord,
                    polygon[i].texCoord,
                    this.bottomParamList);
            }

            const x = position[0];
            if (x < left) {
                left = x;
            }
            if (x > right) {
                right = x;
            }
        }

        const xMin = Math.max(0, Math.ceil(left));
        const xMax = Math.min(this.width, Math.ceil(right));
        this.drawWallRange(xMin, xMax, textureIndex);
    }

    drawWallRange(xMin, xMax, textureIndex) {
        for (let x = xMin; x < xMax; ++x) {
            const topParams = this.topParamList[x];
            const bottomParams = this.bottomParamList[x];
            const z = 1 / topParams.oneOverZ;
            const shadingTable = shadingTableForDistance(z);

            this.drawWallSlice({
                x,
                top: topParams.y,
                bottom: bottomParams.y,
                colorTable: shadingTable,
                texXOffset: topParams.textureXOverZ * z,
                texture: bitmaps[textureIndex],
                textureTop: topParams.textureYOverZ * z,
                textureBottom: bottomParams.textureYOverZ * z,
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
    
    calcLineTextureParamsHorizontal(leftVertex, rightVertex, leftTexCoord, rightTexCoord, params) {
        const xStart = leftVertex[0];
        const xEnd = rightVertex[0];
        
        const oneOverZStart = 1 / leftVertex[2];
        const oneOverZEnd = 1 / rightVertex[2];
        const texXOverZStart = leftTexCoord[0] * oneOverZStart;
        const texXOverZEnd = rightTexCoord[0] * oneOverZEnd;
        const texYOverZStart = leftTexCoord[1] * oneOverZStart;
        const texYOverZEnd = rightTexCoord[1] * oneOverZEnd;

        const yDiff = rightVertex[1] - leftVertex[1];
        const yMin = Math.max(0, Math.ceil(leftVertex[1]));
        const yMax = Math.min(this.height, Math.ceil(rightVertex[1]));

        for (let y = yMin; y < yMax; ++y) {
            const t = (y - leftVertex[1]) / yDiff;
            params[y].x = lerp(t, xStart, xEnd);
            params[y].oneOverZ = lerp(t, oneOverZStart, oneOverZEnd);
            params[y].textureXOverZ = lerp(t, texXOverZStart, texXOverZEnd);
            params[y].textureYOverZ = lerp(t, texYOverZStart, texYOverZEnd);
        }
    }
    
    drawHorizontalPolygon({polygon, textureIndex}) {
        const screenPosition = polygon.map(({position}) => [
            this.viewXToColumn(position[0], position[2]),
            this.viewYToRow(position[1], position[2]),
            position[2],
        ]);
        let top = this.height;
        let bottom = 0;
        for (let i = 0; i < polygon.length; ++i) {
            const nextI = (i + 1) % polygon.length;
            const position = screenPosition[i];
            const nextPosition = screenPosition[nextI];
            if (nextPosition[1] > position[1]) {
                // right of polygon
                this.calcLineTextureParamsHorizontal(
                    position,
                    nextPosition,
                    polygon[i].texCoord,
                    polygon[nextI].texCoord,
                    this.rightParamList);
            } else if (nextPosition[1] < position[1]) {
                // bottom of polygon
                this.calcLineTextureParamsHorizontal(
                    nextPosition,
                    position,
                    polygon[nextI].texCoord,
                    polygon[i].texCoord,
                    this.leftParamList);
            }

            const y = position[1];
            if (y < top) {
                top = y;
            }
            if (y > bottom) {
                bottom = y;
            }
        }

        const yMin = Math.max(0, Math.ceil(top));
        const yMax = Math.min(this.height, Math.ceil(bottom));
        this.drawHorizontalRange(yMin, yMax, textureIndex);
    }

    drawHorizontalRange(yMin, yMax, textureIndex) {
        for (let y = yMin; y < yMax; ++y) {
            const leftParams = this.leftParamList[y];
            const rightParams = this.rightParamList[y];
            const z = 1 / leftParams.oneOverZ;
            const shadingTable = shadingTableForDistance(z);

            this.drawHorizontalSpan({
                y,
                left: leftParams.x,
                right: rightParams.x,
                colorTable: shadingTable,
                texture: bitmaps[textureIndex],
                textureLeftX: leftParams.textureXOverZ * z,
                textureLeftY: leftParams.textureYOverZ * z,
                textureRightX: rightParams.textureXOverZ * z,
                textureRightY: rightParams.textureYOverZ * z,
            });
        }
    }

    drawHorizontalSpan({y, left, right, colorTable, texture, textureLeftX, textureLeftY, textureRightX, textureRightY}) {
        const texels = texture.data;

        let u = textureLeftX * texture.width;
        let v = textureLeftY * texture.height;
        
        const endU = textureRightX * texture.width;
        const endV = textureRightY * texture.height;
        
        const du = (endU - u) / (right - left);
        const dv = (endV - v) / (right - left);

        const uMask = texture.width - 1;
        const vMask = texture.height - 1;

        const xStart = Math.ceil(left);
        const xEnd = Math.ceil(right);

        const nudge = xStart - left;
        u += nudge * du;
        v += nudge * dv;

        let offset = this.width * y + xStart;
        for (let x = xStart; x < xEnd; ++x) {
            const texel = texels[(u & uMask) * texture.width + (v & vMask)];
            const color = colorTable[texel];
            this.pixels[offset++] = color;
            u += du;
            v += dv;
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
        const translated = v2sub(v, this.newOrigin);
        return [v2dot(translated, this.xAxis), v2dot(translated, this.yAxis)];
    }

    unTransform(v)  {
        const translated = [v2dot(v, this.oldXAxis), v2dot(v, this.oldYAxis)];
        return v2add(translated, this.newOrigin);
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

    const frustumLeftDirection = v2scale(5, v2direction(player.facingAngle - player.hFov / 2));
    const frustumRightDirection = v2scale(5, v2direction(player.facingAngle + player.hFov / 2));

    drawLines('yellow', [-0.5, 0], [0.5, 0]);
    drawLines('yellow', [0, -0.5], [0, 0.5]);

    drawLines('green', player.position, v2add(player.position, frustumLeftDirection));
    drawLines('green', player.position, v2add(player.position, frustumRightDirection));

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

    const frustumLeftDirection = v2scale(5, v2direction(player.facingAngle - player.hFov / 2));
    const frustumRightDirection = v2scale(5, v2direction(player.facingAngle + player.hFov / 2));

    const toView = new Transformation(player.position, player.facingAngle);
    const screen = new Screen(canvas.width, canvas.height, pixels, player);

    const drawPolygon = (polygonIndex, clipArea) => {
        const polygon = polygons[polygonIndex];

        const wallsToDraw = [];
        
        for (const edgeIndex of polygon.edges) {
            const edge = edges[edgeIndex];
            const [p1, p2] = world.getEdgeVertices(edge);

            if (! isClockwise(player.position, p1, p2)) {
                continue;
            }

            const length = v2length(v2sub(p1, p2));
            const p1View = toView.transform(p1);
            const p2View = toView.transform(p2);
                  //     texX: length,
                  // };

            const viewPolygon = [
                {
                    position: [p1View[0], polygon.top - player.height, p1View[1]],
                    texCoord: [0, polygon.top],
                },
                {
                    position: [p2View[0], polygon.top - player.height, p2View[1]],
                    texCoord: [length, polygon.top],
                },
                {
                    position: [p2View[0], polygon.bottom - player.height, p2View[1]],
                    texCoord: [length, polygon.bottom],
                },
                {
                    position: [p1View[0], polygon.bottom - player.height, p1View[1]],
                    texCoord: [0, polygon.bottom],
                },
            ];

            const clippedPolygon = clipArea.clipPolygon(viewPolygon);
            
            if (clippedPolygon.length > 0) {
                if (edge.portalTo !== undefined && edge.portalTo !== null) {
                    const projectedXs = clippedPolygon.map(({position}) => position[0] / position[2]);
                    const minX = Math.min(...projectedXs);
                    const maxX = Math.max(...projectedXs);
                    const newClipArea = ClipArea3d.fromPolygon(clippedPolygon);
                    drawPolygon(edge.portalTo, newClipArea);
                    
                    const neighbor = polygons[edge.portalTo];
                    
                    if (neighbor.top < polygon.top) {
                        const abovePoly = clipArea.clipPolygon([
                            {
                                position: [p1View[0], polygon.top - player.height, p1View[1]],
                                texCoord: [0, polygon.top],
                            },
                            {
                                position: [p2View[0], polygon.top - player.height, p2View[1]],
                                texCoord: [length, polygon.top],
                            },
                            {
                                position: [p2View[0], neighbor.top - player.height, p2View[1]],
                                texCoord: [length, neighbor.top],
                            },
                            {
                                position: [p1View[0], neighbor.top - player.height, p1View[1]],
                                texCoord: [0, neighbor.top],
                            }
                        ]);

                        if (abovePoly.length > 0) {
                            wallsToDraw.push({
                                polygon: abovePoly,
                                textureIndex: edge.texture,
                            });
                        }
                    }
                    
                    if (neighbor.bottom > polygon.bottom) {
                        const belowPoly = clipArea.clipPolygon([
                            {
                                position: [p1View[0], neighbor.bottom - player.height, p1View[1]],
                                texCoord: [0, neighbor.bottom],
                            },
                            {
                                position: [p2View[0], neighbor.bottom - player.height, p2View[1]],
                                texCoord: [length, neighbor.bottom],
                            },
                            {
                                position: [p2View[0], polygon.bottom - player.height, p2View[1]],
                                texCoord: [length, polygon.bottom],
                            },
                            {
                                position: [p1View[0], polygon.bottom - player.height, p1View[1]],
                                texCoord: [0, polygon.bottom],
                            }
                        ]);

                        if (belowPoly.length > 0) {
                            wallsToDraw.push({
                                polygon: belowPoly,
                                textureIndex: edge.texture,
                            });
                        }
                    }
                } else {
                    wallsToDraw.push({
                        polygon: clippedPolygon,
                        textureIndex: edge.texture,
                    });
                }
            }
        }

        for (const wall of wallsToDraw) {
            screen.drawWall(wall);
        }

        const vertices = polygon.edges.map(edgeIndex => {
            const edge = edges[edgeIndex];
            const [p1, p2] = world.getEdgeVertices(edge);
            return p1;
        });

        const viewPoints = vertices.map((p) => toView.transform(p));
        if (polygon.top > player.height) {
            const ceiling = clipArea.clipPolygon(viewPoints.map(([x, y], i) => ({
                position: [x, polygon.top - player.height, y],
                texCoord: [vertices[i][0], vertices[i][1]],
            }))).reverse();
            screen.drawHorizontalPolygon({polygon: ceiling, textureIndex: 15 + polygonIndex});
        }

        if (polygon.bottom < player.height) {
            const floor = clipArea.clipPolygon(viewPoints.map(([x, y], i) => ({
                position: [x, polygon.bottom - player.height, y],
                texCoord: [vertices[i][0], vertices[i][1]],
            })));
            screen.drawHorizontalPolygon({polygon: floor, textureIndex: 5 + polygonIndex});
        }
    };

    const left = -Math.tan(player.hFov / 2);
    const right = Math.tan(player.hFov / 2);
    const top = -Math.tan(player.vFov / 2);
    const bottom = Math.tan(player.vFov / 2);
    const clipArea = ClipArea3d.fromPolygon([
        {position: [left, top, 1]},
        {position: [right, top, 1]},
        {position: [right, bottom, 1]},
        {position: [left, bottom, 1]},
    ]);
    drawPolygon(player.polygon, clipArea);
    
    context.putImageData(imageData, 0, 0);
}

function update(player, world, actions, timeSlice, secondsElapsed) {
    let { position, polygon, facingAngle, hFov, vFov } = player;
    const forward = v2direction(facingAngle);
    const left = v2direction(facingAngle - Math.PI / 2);
    const oldPosition = position;
    
    if (actions.has('forward')) {
        position = v2add(position, v2scale(timeSlice * 2, forward));
    }

    if (actions.has('backward')) {
        position = v2add(position, v2scale(-timeSlice * 2, forward));
    }

    if (actions.has('turn-left')) {
        facingAngle = facingAngle - timeSlice * 2;
    }
    
    if (actions.has('turn-right')) {
        facingAngle = facingAngle + timeSlice * 2;
    }
    
    if (actions.has('strafe-left')) {
        position = v2add(position, v2scale(timeSlice * 2, left));
    }
    
    if (actions.has('strafe-right')) {
        position = v2add(position, v2scale(-timeSlice * 2, left));
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


