import {
    Vec2,
    v2normalize,
    v2sub,
    v2dot,
    isClockwise,
} from './vector2';
import { Vec3 } from './vector3';
import { Player } from './index'
import { ClipArea3d, ScreenClipRect } from './clip';
import { sideType, TransferMode } from './files/wad';
import { Transformation } from './transform2d';
import { floorMod } from './utils';
import { ScreenTransform } from './screen-transform';
import { World } from './world';
import { Shapes } from './shapes-loader';
import { Rasterizer, RenderTexture, RenderPolygonProps } from './rasterize';
import { ColorTable } from './color'

interface RendererConstructor {
    world: World;
    player: Player;
    shapes: Shapes;
    rasterizer: Rasterizer;
    seconds: number;
}

interface MakeWallPolygoProps {
    p1View: Vec2;
    p2View: Vec2;
    top: number;
    bottom: number;
}

interface DrawHorizontalPolygonProps {
    viewPoints: Vec2[];
    textureOffset: Vec2;
    height: number;
    isCeiling: boolean;
    texture: RenderTexture | null;
    shadingTables: ColorTable[] | null;
    brightness: number;
    polyTransferMode: number;
    screenClipRect: ScreenClipRect;
}

export interface RenderProps {
    rasterizer: Rasterizer;
    player: Player;
    world: World;
    shapes: Shapes;
    seconds: number;
}

interface DrawListPolygon extends RenderPolygonProps {
    type: 'vertical' | 'horizontal';
}

class Renderer {
    world: World;
    player: Player;
    shapes: Shapes;
    rasterizer: Rasterizer;
    seconds: number;
    viewTransform: Transformation;
    left: number;
    right: number;
    top: number;
    bottom: number;
    clipArea: ClipArea3d;
    landscapeWidth: number;
    landscapeHeight: number;
    landscapeYOffset: number;
    landscapeTiltCorrection: number;
    isSubmerged: boolean;
    screenTransform: ScreenTransform;
    drawList: DrawListPolygon[]

    constructor({ world, player, shapes, rasterizer, seconds }: RendererConstructor) {
        this.world = world;
        this.player = player;
        this.shapes = shapes;
        this.rasterizer = rasterizer;
        this.seconds = seconds;

        const screenTransform = new ScreenTransform(
            rasterizer.width, rasterizer.height, player.hFov, player.vFov, player.verticalAngle);
        this.screenTransform = screenTransform;

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
        this.isSubmerged = Boolean(playerPolyMedia && playerPolyMedia.height > player.height);
        this.drawList = []
    }

    addDrawPolygon(poly: DrawListPolygon) {
        this.drawList.push(poly);
        if (this.drawList.length > 100) {
            for (const poly of this.drawList) {
                if (poly.type === 'vertical') {
                    this.rasterizer.drawWall(poly);
                } else {
                    this.rasterizer.drawHorizontalPolygon(poly);
                }
            }
            this.drawList.length = 0;
        }
    }

    makeWallPolygon({ p1View, p2View, top, bottom }: MakeWallPolygoProps) {
        const topLeft: Vec3 = [p1View[0], top - this.player.height, p1View[1]];
        const topRight: Vec3 = [p2View[0], top - this.player.height, p2View[1]];
        const bottomRight: Vec3 = [p2View[0], bottom - this.player.height, p2View[1]];
        const bottomLeft: Vec3 = [p1View[0], bottom - this.player.height, p1View[1]];
        return [topLeft, topRight, bottomRight, bottomLeft];
    }

    textureLandscapePolygon(vertices: Vec3[]) {
        return vertices.map(position => {
            const projX = position[0] / position[2];
            const projY = position[1] / position[2];
            const fracX = (projX - this.left) / (this.right - this.left);
            const fracY = (projY - this.bottom + this.landscapeTiltCorrection) / (this.top - this.bottom);
            const rotationFrac = floorMod(this.player.facingAngle / Math.PI / 2, 1);
            const projected: Vec3 = [projX, projY, 1]
            const texCoord: Vec2 = [
                fracX * this.landscapeWidth + rotationFrac,
                fracY * this.landscapeHeight + this.landscapeYOffset,
            ]

            return { position: projected, texCoord };
        });
    }

    textureWallPolygon(
        p1View: Vec2,
        p2View: Vec2,
        texTop: number,
        clippedPositions: Vec3[],
        polyTransferMode: number,
        textureOffset: Vec2) {
        if (polyTransferMode === TransferMode.landscape) {
            return this.textureLandscapePolygon(clippedPositions);
        } else {
            const xDirection = v2normalize(v2sub(p2View, p1View));
            const xStart = v2dot(xDirection, p1View);
            const yStart = texTop - this.player.height;
            return clippedPositions.map(position => {
                const texCoord: Vec2 = [
                    v2dot(xDirection, [position[0], position[2]]) - xStart + textureOffset[0],
                    textureOffset[1] - (position[1] - yStart),
                ]
                return {
                    position,
                    texCoord,
                }
            })
        }
    }

    drawHorizontalPolygon({
        viewPoints,
        textureOffset,
        height,
        isCeiling,
        texture,
        shadingTables,
        brightness,
        polyTransferMode,
        screenClipRect,
    }: DrawHorizontalPolygonProps) {
        const polygon = this.clipArea.clipPolygon(viewPoints.map((v) => [v[0], height, v[1]]));

        if (isCeiling) {
            polygon.reverse();
        }

        if (polygon.length > 0) {
            let textured;
            if (polyTransferMode === TransferMode.landscape) {
                textured = this.textureLandscapePolygon(polygon);
            } else {
                textured = polygon.map(position => {
                    const worldVertex = this.viewTransform.unTransform([position[0], position[2]]);
                    const texCoord: Vec2 =
                        [worldVertex[0] + textureOffset[0], worldVertex[1] + textureOffset[1]];
                    return { position, texCoord };
                });
            }

            this.addDrawPolygon({
                type: 'horizontal',
                polygon: textured,
                texture,
                shadingTables,
                brightness,
                transfer: polyTransferMode,
                screenClipRect,
            });
        }
    }

    renderWall(
        polygonIndex: number,
        polyLineIndex: number,
        clipArea: ClipArea3d,
        screenClipRect: ScreenClipRect,
    ) {
        const polygon = this.world.getPolygon(polygonIndex);
        const sideIndex = polygon.sides[polyLineIndex];
        const side = -1 === sideIndex ? null : this.world.getSide(polygon.sides[polyLineIndex]);
        const [p1, p2] = this.world.getLineVertices(polygonIndex, polyLineIndex);
        const portalTo = this.world.getPortal(polygonIndex, polyLineIndex);

        if (!isClockwise(this.player.position, p1, p2)) {
            return;
        }

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
                this.buildPolygonList(portalTo, newClipArea);
            }

            if (neighbor.ceilingHeight < polygon.ceilingHeight && side) {
                const abovePoly = this.clipArea.clipPolygon(this.makeWallPolygon({
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
                        side?.primaryTransferMode || TransferMode.normal,
                        this.world.getTexOffset(side?.primaryTexture));
                    this.addDrawPolygon({
                        type: 'vertical',
                        polygon: texturedPolygon, // abovePoly,
                        texture: this.shapes.getBitmap(side.primaryTexture.texture),
                        shadingTables: this.shapes.getShadingTables(side.primaryTexture.texture),
                        brightness: this.world.getLightIntensity(side.primaryLightsourceIndex),
                        transfer: side?.primaryTransferMode || TransferMode.normal,
                        screenClipRect,
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
                const belowPoly = this.clipArea.clipPolygon(this.makeWallPolygon({
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
                        transferMode || TransferMode.normal,
                        this.world.getTexOffset(sideTex));

                    this.addDrawPolygon({
                        type: 'vertical',
                        polygon: texturedPolygon,
                        texture: this.shapes.getBitmap(sideTex.texture),
                        shadingTables: this.shapes.getShadingTables(sideTex.texture),
                        brightness: this.world.getLightIntensity(
                            (side.type === sideType.split
                                ? side.secondaryLightsourceIndex
                                : side.primaryLightsourceIndex)),
                        transfer: transferMode || TransferMode.normal,
                        screenClipRect,
                    });
                }
            }

            if (side?.transparentTexture && side.transparentTexture.texture !== 0xffff) {
                const bottom = Math.max(neighbor.floorHeight, polygon.floorHeight);
                const top = Math.min(neighbor.ceilingHeight, polygon.ceilingHeight);
                const sideTex = side.transparentTexture;
                const transparentPoly = this.clipArea.clipPolygon(this.makeWallPolygon({
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

                    this.addDrawPolygon({
                        type: 'vertical',
                        polygon: texturedPolygon,
                        texture: this.shapes.getBitmap(sideTex.texture),
                        shadingTables: this.shapes.getShadingTables(sideTex.texture),
                        brightness: this.world.getLightIntensity(side.transparentLightsourceIndex),
                        transfer: side?.transparentTransferMode,
                        isTransparent: true,
                        screenClipRect,
                    });
                }
            }
        } else {
            const viewPolygon = this.makeWallPolygon({
                p1View,
                p2View,
                top: polygon.ceilingHeight,
                bottom: polygon.floorHeight,
            });

            const clippedPolygon = this.clipArea.clipPolygon(viewPolygon);

            if (side && clippedPolygon.length > 0) {
                const texturedPolygon = this.textureWallPolygon(
                    p1View,
                    p2View,
                    polygon.ceilingHeight,
                    clippedPolygon,
                    side?.primaryTransferMode || TransferMode.normal,
                    this.world.getTexOffset(side?.primaryTexture));

                this.addDrawPolygon({
                    type: 'vertical',
                    polygon: texturedPolygon, // clippedPolygon,
                    texture: this.shapes.getBitmap(side.primaryTexture.texture),
                    shadingTables: this.shapes.getShadingTables(side.primaryTexture.texture),
                    brightness: this.world.getLightIntensity(side.primaryLightsourceIndex),
                    transfer: side?.primaryTransferMode || TransferMode.normal,
                    screenClipRect
                });
            }
        }

    }

    buildPolygonList(polygonIndex: number, clipArea: ClipArea3d) {
        const screenClipRect = clipArea.screenClipRect(this.screenTransform)
        const polygon = this.world.getPolygon(polygonIndex);

        for (let polyLineIndex = 0; polyLineIndex < polygon.vertexCount; ++polyLineIndex) {
            this.renderWall(polygonIndex, polyLineIndex, clipArea, screenClipRect);
        }

        const vertices = polygon.endpoints.map(idx => this.world.getPoint(idx));

        const { floor, ceiling } = this.world.getPolygonFloorCeiling(
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
                isCeiling: true,
                texture: this.shapes.getBitmap(ceiling.texture),
                shadingTables: this.shapes.getShadingTables(ceiling.texture),
                brightness: ceiling.lightIntensity,
                polyTransferMode: ceiling.transferMode,
                screenClipRect,
            });
        }

        if (polygon.floorHeight < this.player.height) {
            this.drawHorizontalPolygon({
                viewPoints,
                textureOffset: floor.textureOffset,
                height: floor.height - this.player.height,
                isCeiling: false,
                texture: this.shapes.getBitmap(floor.texture),
                shadingTables: this.shapes.getShadingTables(floor.texture),
                brightness: floor.lightIntensity,
                polyTransferMode: floor.transferMode,
                screenClipRect,
            });
        }
    }

    render() {
        this.buildPolygonList(this.player.polygon, this.clipArea);
        for (const poly of this.drawList) {
            if (poly.type === 'vertical') {
                this.rasterizer.drawWall(poly);
            } else {
                this.rasterizer.drawHorizontalPolygon(poly);
            }
        }
    }
}

export function render({ rasterizer, player, world, shapes, seconds }: RenderProps): void {
    const renderer = new Renderer({ world, player, shapes, rasterizer, seconds });
    renderer.render();
}
