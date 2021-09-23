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
import {v3sub, v3normalize, v3dot} from './vector3.js';
import {ClipArea3d} from './clip.js';
import {sideType, transferMode} from './files/wad.js';
import {Transformation} from './transform2d.js';
import {floorMod} from './utils.js';
import {ScreenTransform} from './screen-transform.js';

class Renderer {
    constructor({world, player, shapes, rasterizer, seconds}) {
        this.world = world;
        this.player = player;
        this.shapes = shapes;
        this.rasterizer = rasterizer;
        this.seconds = seconds;

        const screenTransform = new ScreenTransform(
            rasterizer.width, rasterizer.height, player.hFov, player.vFov, player.verticalAngle);
        
        this.viewTransform = new Transformation(player.position, player.facingAngle);
        const epsilon = 0.0001;
        this.left = screenTransform.left - epsilon;
        this.right = screenTransform.right + epsilon;
        this.top = screenTransform.top + epsilon;
        this.bottom = screenTransform.bottom - epsilon;

        this.clipArea = ClipArea3d.fromPolygon([
            [this.left, this.top, 1],
            [this.right, this.top, 1],
            [this.right, this.bottom, 1],
            [this.left, this.bottom, 1],
        ]);

        this.landscapeWidth = player.hFov / Math.PI / 2;
        this.landscapeHeight = this.landscapeWidth / rasterizer.width * rasterizer.height * 1024 / 540;
        this.landscapeYOffset = (1 - this.landscapeHeight) / 2;
        this.landscapeTiltCorrection = Math.tan(this.player.verticalAngle);

        const playerPolyMedia = world.getMediaInfo(player.polygon, seconds);
        this.isSubmerged = playerPolyMedia && playerPolyMedia.height > player.height;
    }

    makeWallPolygon({p1View, p2View, top, bottom}) {
        const length = v2length(v2sub(p1View, p2View));

        return [
            [p1View[0], top - this.player.height, p1View[1]],
            [p2View[0], top - this.player.height, p2View[1]],
            [p2View[0], bottom - this.player.height, p2View[1]],
            [p1View[0], bottom - this.player.height, p1View[1]],
        ];
    }

    textureLandscapePolygon(vertices) {
        return vertices.map(position => {
            const projX = position[0] / position[2];
            const projY = position[1] / position[2];
            const fracX = (projX - this.left) / (this.right - this.left);
            const fracY = (projY - this.bottom + this.landscapeTiltCorrection) / (this.top - this.bottom);
            const rotationFrac = floorMod(this.player.facingAngle / Math.PI / 2, 1);
            return {
                position: [projX, projY, 1],
                texCoord: [
                    fracX * this.landscapeWidth + rotationFrac,
                    fracY * this.landscapeHeight + this.landscapeYOffset,
                    // position[0] / position[2],
                    // position[1] / position[2]
                ]
            };
        });
    }

    textureWallPolygon(p1View, p2View, texTop, clippedPositions, polyTransferMode, textureOffset) {
        if (polyTransferMode === transferMode.landscape) {
            return this.textureLandscapePolygon(clippedPositions);
        } else {
            const xDirection = v2normalize(v2sub(p2View, p1View));
            const xStart = v2dot(xDirection, p1View);
            const yStart = texTop - this.player.height;
            return clippedPositions.map(position => ({
                position,
                texCoord: [
                    v2dot(xDirection, [position[0], position[2]]) - xStart + textureOffset[0],
                    textureOffset[1] - (position[1] - yStart),
                ],
            }));
        }
    }

    drawHorizontalPolygon({
        viewPoints, textureOffset, height, clipArea, isCeiling, texture, brightness, polyTransferMode
    }) {
        const polygon = clipArea.clipPolygon(viewPoints.map((v) => [v[0], height, v[1]]));
        
        if (isCeiling) {
            polygon.reverse();
        }
        
        if (polygon.length > 0) {
            let textured;
            if (polyTransferMode === transferMode.landscape) {
                textured = this.textureLandscapePolygon(polygon);
            } else {
                textured = polygon.map(position => {
                    const worldVertex = this.viewTransform.unTransform([position[0], position[2]]);
                    return {
                        position,
                        texCoord: [worldVertex[0] + textureOffset[0], worldVertex[1] + textureOffset[1]],
                    };
                });
            }
            
            this.rasterizer.drawHorizontalPolygon({
                polygon: textured,
                texture,
                brightness,
                transfer: polyTransferMode,
            });
        }
    }

    renderWall(polygonIndex, polyLineIndex, clipArea) {
        const polygon = this.world.getPolygon(polygonIndex);
        const sideIndex = polygon.sides[polyLineIndex];
        const side = -1 === sideIndex ? null : this.world.getSide(polygon.sides[polyLineIndex]);
        const [p1, p2] = this.world.getLineVertices(polygonIndex, polyLineIndex);
        const portalTo = this.world.getPortal(polygonIndex, polyLineIndex);

        if (! isClockwise(this.player.position, p1, p2)) {
            return;
        }

        const length = v2length(v2sub(p1, p2));
        const p1View = this.viewTransform.transform(p1);
        const p2View = this.viewTransform.transform(p2);

        if (portalTo !== -1 && portalTo !== undefined && portalTo !== null) {
            const neighbor = this.world.getPolygon(portalTo);
            const viewPolygon = this.makeWallPolygon({
                p1View,
                p2View,
                top: Math.min(polygon.ceilingHeight, neighbor.ceilingHeight),
                bottom: Math.max(polygon.floorHeight, neighbor.floorHeight),
            });

            const clippedPolygon = clipArea.clipPolygon(viewPolygon);
            if (clippedPolygon.length > 0) {
                const newClipArea = ClipArea3d.fromPolygon(clippedPolygon);
                this.renderPolygon(portalTo, newClipArea);
            }
            
            if (neighbor.ceilingHeight < polygon.ceilingHeight && side) {
                const abovePoly = clipArea.clipPolygon(this.makeWallPolygon({
                    p1View,
                    p2View,
                    top: polygon.ceilingHeight,
                    bottom: neighbor.ceilingHeight,
                }));

                if (abovePoly.length > 0) {
                    const texturedPolygon = this.textureWallPolygon(
                        p1View,
                        p2View,
                        polygon.ceilingHeight,
                        abovePoly,
                        side?.primaryTransferMode || transferMode.normal,
                        this.world.getTexOffset(side?.primaryTexture));
                    this.rasterizer.drawWall({
                        polygon: texturedPolygon, // abovePoly,
                        texture: this.shapes.getBitmap(side.primaryTexture.texture),
                        brightness: this.world.getLightIntensity(side.primaryLightsourceIndex),
                        transfer: side?.primaryTransferMode || transferMode.normal,
                    });
                }
            }
            
            if (neighbor.floorHeight > polygon.floorHeight && side) {
                const sideTex = side.type === sideType.split
                      ? side.secondaryTexture
                      : side.primaryTexture;
                const transferMode = side.type === sideType.split
                      ? side.secondaryTransferMode
                      : side.primaryTransferMode;
                const belowPoly = clipArea.clipPolygon(this.makeWallPolygon({
                    p1View,
                    p2View,
                    top: neighbor.floorHeight,
                    bottom: polygon.floorHeight,
                }));

                if (belowPoly.length > 0) {
                    const texturedPolygon = this.textureWallPolygon(
                        p1View,
                        p2View,
                        neighbor.floorHeight,
                        belowPoly,
                        transferMode || transferMode.normal,
                        this.world.getTexOffset(sideTex));
                    
                    this.rasterizer.drawWall({
                        polygon: texturedPolygon,
                        texture: this.shapes.getBitmap(sideTex.texture),
                        brightness: this.world.getLightIntensity(
                            (side.type === sideType.split
                             ? side.secondaryLightsourceIndex
                             : side.primaryLightsourceIndex)),
                        transfer: transferMode || transferMode.normal,
                    });
                }
            }

            if (side?.transparentTexture && side.transparentTexture.texture !== 0xffff) {
                const bottom = Math.max(neighbor.floorHeight, polygon.floorHeight);
                const top = Math.min(neighbor.ceilingHeight, polygon.ceilingHeight);
                const sideTex = side.transparentTexture;
                const transparentPoly = clipArea.clipPolygon(this.makeWallPolygon({
                    p1View,
                    p2View,
                    top,
                    bottom,
                }));

                if (transparentPoly.length > 0) {
                    const texturedPolygon = this.textureWallPolygon(
                        p1View,
                        p2View,
                        top,
                        transparentPoly,
                        side?.transparentTransferMode,
                        this.world.getTexOffset(sideTex));
                    
                    this.rasterizer.drawWall({
                        polygon: texturedPolygon,
                        texture: this.shapes.getBitmap(sideTex.texture),
                        brightness: this.world.getLightIntensity(side.transparentLightsourceIndex),
                        transferMode: side?.transparentTransferMode,
                        isTransparent: true,
                    });
                }
            }
        } else {
            const viewPolygon = this.makeWallPolygon({
                p1View,
                p2View,
                top: polygon.ceilingHeight,
                bottom: polygon.floorHeight,
                playerHeight: this.player.height,
            });

            const clippedPolygon = clipArea.clipPolygon(viewPolygon);

            if (side && clippedPolygon.length > 0) {
                const texturedPolygon = this.textureWallPolygon(
                    p1View,
                    p2View,
                    polygon.ceilingHeight,
                    clippedPolygon,
                    side?.primaryTransferMode || transferMode.normal,
                    this.world.getTexOffset(side?.primaryTexture));

                this.rasterizer.drawWall({
                    polygon: texturedPolygon, // clippedPolygon,
                    texture: this.shapes.getBitmap(side.primaryTexture.texture),
                    brightness: this.world.getLightIntensity(side.primaryLightsourceIndex),
                    transfer: side?.primaryTransferMode || transferMode.normal,
                });
            }
        }

    }

    renderPolygon(polygonIndex, clipArea) {
        const polygon = this.world.getPolygon(polygonIndex);

        for (let polyLineIndex = 0; polyLineIndex < polygon.vertexCount; ++polyLineIndex) {
            this.renderWall(polygonIndex, polyLineIndex, clipArea);
        }

        const vertices = polygon.endpoints.map(idx => this.world.getPoint(idx));

        const {floor, ceiling} = this.world.getPolygonFloorCeiling(
            polygonIndex,
            this.player.height,
            this.isSubmerged,
            this.seconds);

        const viewPoints = vertices.map((p) => this.viewTransform.transform(p));
        if (polygon.ceilingHeight > this.player.height) {
            this.drawHorizontalPolygon({
                viewPoints,
                textureOffset: ceiling.textureOffset,
                height: ceiling.height - this.player.height,
                clipArea,
                isCeiling: true,
                texture: this.shapes.getBitmap(ceiling.texture),
                brightness: ceiling.lightIntensity,
                polyTransferMode: ceiling.transferMode,
            });
        }

        if (polygon.floorHeight < this.player.height) {
            this.drawHorizontalPolygon({
                viewPoints,
                textureOffset: floor.textureOffset,
                height: floor.height - this.player.height,
                clipArea,
                isCeiling: false,
                texture: this.shapes.getBitmap(floor.texture),
                brightness: floor.lightIntensity,
                polyTransferMode: floor.transferMode,
            });
        }
    }

    render() {
        this.renderPolygon(this.player.polygon, this.clipArea);
    }
}
        
export function render({rasterizer, player, world, shapes, seconds}) {
    const renderer = new Renderer({world, player, shapes, rasterizer, seconds});
    renderer.render();
}
