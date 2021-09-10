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
import { ClipArea3d } from './clip.js';
import {
    sideTypeFull,
    sideTypeHigh,
    sideTypeLow,
    sideTypeComposite,
    sideTypeSplit
} from './files/wad.js';
import { Transformation } from './transform2d.js';

function makeViewPolygon({drawList, p1View, p2View, top, bottom, playerHeight, textureOffset}) {
    const length = v2length(v2sub(p1View, p2View));
    
    return [
        {
            position: [p1View[0], top - playerHeight, p1View[1]],
            texCoord: [textureOffset[0], textureOffset[1]],
        },
        {
            position: [p2View[0], top - playerHeight, p2View[1]],
            texCoord: [textureOffset[0] + length, textureOffset[1]],
        },
        {
            position: [p2View[0], bottom - playerHeight, p2View[1]],
            texCoord: [textureOffset[0] + length, textureOffset[1] - bottom + top],
        },
        {
            position: [p1View[0], bottom - playerHeight, p1View[1]],
            texCoord: [textureOffset[0], textureOffset[1] - bottom + top],
        },
    ];
}

class DrawList {
    constructor({world, player, shapes, viewTransform, rasterizer}) {
        this.world = world;
        this.player = player;
        this.shapes = shapes;
        this.viewTransform = viewTransform;
        this.rasterizer = rasterizer;
        this.drawList = [];
    }

    renderWall(polygonIndex, polyLineIndex, clipArea) {
        const polygon = this.world.polygons[polygonIndex];
        const side = this.world.sides[polygon.sides[polyLineIndex]];
        const [p1, p2] = this.world.getLineVertices(polygonIndex, polyLineIndex);
        const portalTo = this.world.getPortal(polygonIndex, polyLineIndex);

        if (! isClockwise(this.player.position, p1, p2)) {
            return;
        }

        const length = v2length(v2sub(p1, p2));
        const p1View = this.viewTransform.transform(p1);
        const p2View = this.viewTransform.transform(p2);

        if (portalTo !== -1 && portalTo !== undefined && portalTo !== null) {
            const neighbor = this.world.polygons[portalTo];
            const viewPolygon = makeViewPolygon({
                p1View,
                p2View,
                top: Math.min(polygon.ceilingHeight, neighbor.ceilingHeight),
                bottom: Math.max(polygon.floorHeight, neighbor.floorHeight),
                playerHeight: this.player.height,
                textureOffset: this.world.getTexOffset(side?.primaryTexture),
            });

            const clippedPolygon = clipArea.clipPolygon(viewPolygon);
            if (clippedPolygon.length > 0) {
                const newClipArea = ClipArea3d.fromPolygon(clippedPolygon);
                this.renderPolygon(portalTo, newClipArea);
            }
            
            if (neighbor.ceilingHeight < polygon.ceilingHeight && side) {
                const abovePoly = clipArea.clipPolygon(makeViewPolygon({
                    p1View,
                    p2View,
                    top: polygon.ceilingHeight,
                    bottom: neighbor.ceilingHeight,
                    playerHeight: this.player.height,
                    textureOffset: this.world.getTexOffset(side?.primaryTexture),
                }));
                
                if (abovePoly.length > 0) {
                    this.rasterizer.drawWall({
                        polygon: abovePoly,
                        texture: this.shapes.getBitmap(side.primaryTexture.texture),
                        brightness: this.world.getLightIntensity(side.primaryLightsourceIndex),
                    });
                }
            }
            
            if (neighbor.floorHeight > polygon.floorHeight && side) {
                const sideTex = (side.type === sideTypeSplit
                                 ? side.secondaryTexture
                                 : side.primaryTexture);
                const belowPoly = clipArea.clipPolygon(makeViewPolygon({
                    p1View,
                    p2View,
                    top: neighbor.floorHeight,
                    bottom: polygon.floorHeight,
                    playerHeight: this.player.height,
                    textureOffset: this.world.getTexOffset(sideTex),
                }));

                if (belowPoly.length > 0) {
                    this.rasterizer.drawWall({
                        polygon: belowPoly,
                        texture: this.shapes.getBitmap(sideTex.texture),
                        brightness: this.world.getLightIntensity(
                            (side.type === sideTypeSplit
                             ? side.secondaryLightsourceIndex
                             : side.primaryLightsourceIndex)),
                    });
                }
            }
        } else {
            const viewPolygon = makeViewPolygon({
                p1View,
                p2View,
                top: polygon.ceilingHeight,
                bottom: polygon.floorHeight,
                playerHeight: this.player.height,
                textureOffset: this.world.getTexOffset(side?.primaryTexture),
            });

            const clippedPolygon = clipArea.clipPolygon(viewPolygon);

            if (side && clippedPolygon.length > 0) {
                this.rasterizer.drawWall({
                    polygon: clippedPolygon,
                    texture: this.shapes.getBitmap(side.primaryTexture.texture),
                    brightness: this.world.getLightIntensity(side.primaryLightsourceIndex),
                });
            }
        }

    }

    renderPolygon(polygonIndex, clipArea) {
        const polygon = this.world.polygons[polygonIndex];

        for (let polyLineIndex = 0; polyLineIndex < polygon.vertexCount; ++polyLineIndex) {
            this.renderWall(polygonIndex, polyLineIndex, clipArea);
        }

        const vertices = polygon.endpoints.map(idx => this.world.points[idx]);

        const viewPoints = vertices.map((p) => this.viewTransform.transform(p));
        if (polygon.ceilingHeight > this.player.height) {
            const offset = this.world.getCeilingOffset(polygonIndex);
            const ceiling = clipArea.clipPolygon(viewPoints.map(([x, y], i) => ({
                position: [x, polygon.ceilingHeight - this.player.height, y],
                texCoord: [vertices[i][0] + offset[0], vertices[i][1] + offset[1]],
            }))).reverse();
            if (ceiling.length > 0) {
                this.rasterizer.drawHorizontalPolygon({
                    polygon: ceiling,
                    texture: this.shapes.getBitmap(polygon.ceilingTex),
                    brightness: this.world.getLightIntensity(polygon.floorLightsource),
                });
            }
        }

        if (polygon.floorHeight < this.player.height) {
            const offset = this.world.getFloorOffset(polygonIndex);;
            const floor = clipArea.clipPolygon(viewPoints.map(([x, y], i) => ({
                position: [x, polygon.floorHeight - this.player.height, y],
                texCoord: [vertices[i][0] + offset[0], vertices[i][1] + offset[1]],
            })));
            if (floor.length > 0) {
                this.rasterizer.drawHorizontalPolygon({
                    polygon: floor,
                    texture: this.shapes.getBitmap(polygon.floorTex),
                    brightness: this.world.getLightIntensity(polygon.ceilingLightsource),
                });
            }
        }
    }

    render(clipArea) {
        this.renderPolygon(this.player.polygon, clipArea);
    }
}
        

export function render({rasterizer, player, world, shapes}) {
    const viewTransform = new Transformation(player.position, player.facingAngle);
    const epsilon = 0.0001;
    const left = -Math.tan(player.hFov / 2) - epsilon;
    const right = Math.tan(player.hFov / 2) + epsilon;
    const top = -Math.tan(player.vFov / 2) - epsilon;
    const bottom = Math.tan(player.vFov / 2) + epsilon;
    
    const clipArea = ClipArea3d.fromPolygon([
        {position: [left, top, 1]},
        {position: [right, top, 1]},
        {position: [right, bottom, 1]},
        {position: [left, bottom, 1]},
    ]);

    const drawList = new DrawList({world, player, shapes, viewTransform, rasterizer});
    drawList.render(clipArea);
}
