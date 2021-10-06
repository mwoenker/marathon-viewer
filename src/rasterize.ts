import { Vec3 } from './vector3'
import { Vec2 } from './vector2'
import { lerp, floorMod } from './utils';
import { ColorTable, shadingTableForDistance } from './color';
import { TransferMode } from './files/wad';
import { ScreenTransform } from './screen-transform';
import { ScreenClipRect } from './clip';

interface PlayerProps {
    hFov: number;
    vFov: number;
    verticalAngle: number
}

interface VerticalPolyLineParams {
    y: number;
    oneOverZ: number;
    textureXOverZ: number;
    textureYOverZ: number;
}

interface HorizontalPolyLineParams {
    x: number;
    oneOverZ: number;
    textureXOverZ: number;
    textureYOverZ: number;
}

export interface RenderTexture {
    data: Uint8Array;
    width: number;
    height: number;
}

interface RenderPolygon {
    position: Vec3;
    texCoord: Vec2;
}

interface RenderPolygonProps {
    polygon: RenderPolygon[];
    texture: RenderTexture | null;
    brightness: number;
    transfer: number;
    isTransparent?: boolean;
    shadingTables: ColorTable[] | null;
    screenClipRect: ScreenClipRect;
}

interface WallSlice {
    x: number,
    top: number,
    bottom: number,
    colorTable: ColorTable,
    texXOffset: number,
    texture: RenderTexture,
    textureTop: number,
    textureBottom: number,
    screenClipRect: ScreenClipRect,
}

interface HorizontalSpan {
    y: number,
    left: number,
    right: number,
    colorTable: ColorTable,
    texture: RenderTexture,
    textureLeftX: number,
    textureLeftY: number,
    textureRightX: number,
    textureRightY: number,
    screenClipRect: ScreenClipRect,
}

export class Rasterizer {
    pixels: Uint32Array;
    screenTransform: ScreenTransform;
    width: number;
    height: number;
    topParamList: VerticalPolyLineParams[];
    bottomParamList: VerticalPolyLineParams[];
    leftParamList: HorizontalPolyLineParams[];
    rightParamList: HorizontalPolyLineParams[];

    constructor(width: number, height: number, pixels: Uint32Array, player: PlayerProps) {
        this.pixels = pixels;
        this.screenTransform = new ScreenTransform(
            width,
            height,
            player.hFov,
            player.vFov,
            player.verticalAngle
        );

        this.width = width;
        this.height = height;

        this.topParamList = new Array<VerticalPolyLineParams>(width);
        this.bottomParamList = new Array<VerticalPolyLineParams>(width);

        for (let i = 0; i < width; ++i) {
            this.topParamList[i] = {
                y: 0,
                oneOverZ: 0,
                textureXOverZ: 0,
                textureYOverZ: 0,
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
                textureXOverZ: 0,
                textureYOverZ: 0,
            };
            this.rightParamList[i] = {
                x: 0,
                oneOverZ: 0,
                textureXOverZ: 0,
                textureYOverZ: 0,
            };
        }
    }

    calcLineTextureParams(
        leftVertex: Vec3,
        rightVertex: Vec3,
        leftTexCoord: Vec2,
        rightTexCoord: Vec2,
        params: VerticalPolyLineParams[],
        clipLeft: number,
        clipRight: number,
    ): void {
        const yStart = leftVertex[1];
        const yEnd = rightVertex[1];

        const oneOverZStart = 1 / leftVertex[2];
        const oneOverZEnd = 1 / rightVertex[2];
        const texXOverZStart = leftTexCoord[0] * oneOverZStart;
        const texXOverZEnd = rightTexCoord[0] * oneOverZEnd;
        const texYOverZStart = leftTexCoord[1] * oneOverZStart;
        const texYOverZEnd = rightTexCoord[1] * oneOverZEnd;

        const xDiff = rightVertex[0] - leftVertex[0];
        const xMin = Math.max(0, clipLeft, Math.ceil(leftVertex[0]));
        const xMax = Math.min(this.width, clipRight, Math.ceil(rightVertex[0]));

        for (let x = xMin; x < xMax; ++x) {
            const t = (x - leftVertex[0]) / xDiff;
            params[x].y = lerp(t, yStart, yEnd);
            params[x].oneOverZ = lerp(t, oneOverZStart, oneOverZEnd);
            params[x].textureXOverZ = lerp(t, texXOverZStart, texXOverZEnd);
            params[x].textureYOverZ = lerp(t, texYOverZStart, texYOverZEnd);
        }
    }

    drawWall(props: RenderPolygonProps): void {
        if (props.transfer === TransferMode.landscape) {
            this.textureHorizontalPolygon(props);
        } else {
            this.textureWall(props);
        }
    }

    textureWall(
        { polygon, texture, brightness, shadingTables, isTransparent = false, screenClipRect }: RenderPolygonProps
    ): void {
        if (!texture || !shadingTables) {
            return;
        }

        const screenPosition = polygon.map(({ position }) =>
            this.screenTransform.viewToScreen(position));

        let allLeft = true;
        let allRight = true;

        for (const position of screenPosition) {
            if (position[0] >= screenClipRect.left) {
                allLeft = false;
            }
            if (position[0] <= screenClipRect.right) {
                allRight = false;
            }
        }

        if (allLeft || allRight) {
            return;
        }

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
                    this.topParamList,
                    screenClipRect.left,
                    screenClipRect.right
                );
            } else if (nextPosition[0] < position[0]) {
                // bottom of polygon
                this.calcLineTextureParams(
                    nextPosition,
                    position,
                    polygon[nextI].texCoord,
                    polygon[i].texCoord,
                    this.bottomParamList,
                    screenClipRect.left,
                    screenClipRect.right);
            }

            const x = position[0];
            if (x < left) {
                left = x;
            }
            if (x > right) {
                right = x;
            }
        }

        const xMin = Math.max(0, screenClipRect.left, Math.ceil(left));
        const xMax = Math.min(this.width, screenClipRect.right, Math.ceil(right));
        this.textureWallRange(xMin, xMax, texture, shadingTables, brightness, isTransparent, screenClipRect);
    }

    textureWallRange(
        xMin: number,
        xMax: number,
        texture: RenderTexture,
        shadingTables: ColorTable[],
        brightness: number,
        isTransparent: boolean,
        screenClipRect: ScreenClipRect,
    ): void {
        for (let x = xMin; x < xMax; ++x) {
            const topParams = this.topParamList[x];
            const bottomParams = this.bottomParamList[x];
            const z = 1 / topParams.oneOverZ;
            const shadingTable = shadingTableForDistance(shadingTables, z, brightness);

            if (isTransparent) {
                this.textureWallSliceTransparent({
                    x,
                    top: topParams.y,
                    bottom: bottomParams.y,
                    colorTable: shadingTable,
                    texXOffset: topParams.textureXOverZ * z,
                    texture,
                    textureTop: topParams.textureYOverZ * z,
                    textureBottom: bottomParams.textureYOverZ * z,
                    screenClipRect,
                });
            } else {
                this.textureWallSlice({
                    x,
                    top: topParams.y,
                    bottom: bottomParams.y,
                    colorTable: shadingTable,
                    texXOffset: topParams.textureXOverZ * z,
                    texture,
                    textureTop: topParams.textureYOverZ * z,
                    textureBottom: bottomParams.textureYOverZ * z,
                    screenClipRect,
                });
            }
        }
    }

    textureWallSlice(
        { x, top, bottom, colorTable, texXOffset, texture, textureTop, textureBottom, screenClipRect }: WallSlice
    ): void {
        const intTop = Math.max(0, screenClipRect.top, Math.ceil(top));
        const intBottom = Math.min(this.height, screenClipRect.bottom, Math.ceil(bottom));
        const texels = texture.data;

        let offset = x + this.width * intTop;
        const increment = this.width;
        const texelX = floorMod(Math.floor(texXOffset * texture.width), 128);
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

    textureWallSliceTransparent({
        x,
        top,
        bottom,
        colorTable,
        texXOffset,
        texture,
        textureTop,
        textureBottom,
        screenClipRect
    }: WallSlice): void {
        const intTop = Math.max(0, screenClipRect.top, Math.ceil(top));
        const intBottom = Math.min(this.height, screenClipRect.bottom, Math.ceil(bottom));
        const texels = texture.data;

        let offset = x + this.width * intTop;
        const increment = this.width;
        const texelX = floorMod(Math.floor(texXOffset * texture.width), 128);
        const texYMask = texture.height - 1;

        const rowBase = texelX * texture.width;
        const texelYSlope = (textureBottom - textureTop) * texture.height / (bottom - top);
        let texelY = textureTop * texture.height + (intTop - top) * texelYSlope;

        for (let y = intTop; y < intBottom; ++y) {
            const wrappedY = texelY & texYMask;
            const texel = texels[rowBase + wrappedY];
            if (texel !== 0) {
                const color = colorTable[texel];
                this.pixels[offset] = color;
            }
            offset += increment;
            texelY += texelYSlope;
        }
    }

    drawHorizontalPolygon(props: RenderPolygonProps): void {
        this.textureHorizontalPolygon(props)
    }

    calcLineTextureParamsHorizontal(
        leftVertex: Vec3,
        rightVertex: Vec3,
        leftTexCoord: Vec2,
        rightTexCoord: Vec2,
        params: HorizontalPolyLineParams[],
        clipTop: number,
        clipBottom: number,
    ): void {
        const xStart = leftVertex[0];
        const xEnd = rightVertex[0];

        const oneOverZStart = 1 / leftVertex[2];
        const oneOverZEnd = 1 / rightVertex[2];
        const texXOverZStart = leftTexCoord[0] * oneOverZStart;
        const texXOverZEnd = rightTexCoord[0] * oneOverZEnd;
        const texYOverZStart = leftTexCoord[1] * oneOverZStart;
        const texYOverZEnd = rightTexCoord[1] * oneOverZEnd;

        const yDiff = rightVertex[1] - leftVertex[1];
        const yMin = Math.max(0, clipTop, Math.ceil(leftVertex[1]));
        const yMax = Math.min(this.height, clipBottom, Math.ceil(rightVertex[1]));

        for (let y = yMin; y < yMax; ++y) {
            const t = (y - leftVertex[1]) / yDiff;
            params[y].x = lerp(t, xStart, xEnd);
            params[y].oneOverZ = lerp(t, oneOverZStart, oneOverZEnd);
            params[y].textureXOverZ = lerp(t, texXOverZStart, texXOverZEnd);
            params[y].textureYOverZ = lerp(t, texYOverZStart, texYOverZEnd);
        }
    }

    textureHorizontalPolygon({ polygon, texture, brightness, shadingTables, transfer, screenClipRect }: RenderPolygonProps): void {
        if (!texture || !shadingTables) {
            return;
        }

        const screenPosition = polygon.map(({ position }) =>
            this.screenTransform.viewToScreen(position));
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
                    this.rightParamList,
                    screenClipRect.top,
                    screenClipRect.bottom);
            } else if (nextPosition[1] < position[1]) {
                // bottom of polygon
                this.calcLineTextureParamsHorizontal(
                    nextPosition,
                    position,
                    polygon[nextI].texCoord,
                    polygon[i].texCoord,
                    this.leftParamList,
                    screenClipRect.top,
                    screenClipRect.bottom);
            }

            const y = position[1];
            if (y < top) {
                top = y;
            }
            if (y > bottom) {
                bottom = y;
            }
        }

        const yMin = Math.max(0, screenClipRect.top, Math.ceil(top));
        const yMax = Math.min(this.height, screenClipRect.bottom, Math.ceil(bottom));
        this.textureHorizontalRange(yMin, yMax, texture, shadingTables, brightness, transfer, screenClipRect)
    }

    textureHorizontalRange(
        yMin: number,
        yMax: number,
        texture: RenderTexture,
        shadingTables: ColorTable[],
        brightness: number,
        transfer: number,
        screenClipRect: ScreenClipRect
    ): void {
        for (let y = yMin; y < yMax; ++y) {
            const leftParams = this.leftParamList[y];
            const rightParams = this.rightParamList[y];
            const z = 1 / leftParams.oneOverZ;

            if (transfer === TransferMode.landscape) {
                const shadingTable = shadingTableForDistance(shadingTables, 0, 1);
                this.landscapeHorizontalSpan({
                    y,
                    left: leftParams.x,
                    right: rightParams.x,
                    colorTable: shadingTable,
                    texture,
                    textureLeftX: leftParams.textureXOverZ * z,
                    textureLeftY: leftParams.textureYOverZ * z,
                    textureRightX: rightParams.textureXOverZ * z,
                    textureRightY: rightParams.textureYOverZ * z,
                    screenClipRect
                });
            } else {
                const shadingTable = shadingTableForDistance(shadingTables, z, brightness);
                this.textureHorizontalSpan({
                    y,
                    left: leftParams.x,
                    right: rightParams.x,
                    colorTable: shadingTable,
                    texture,
                    textureLeftX: leftParams.textureXOverZ * z,
                    textureLeftY: leftParams.textureYOverZ * z,
                    textureRightX: rightParams.textureXOverZ * z,
                    textureRightY: rightParams.textureYOverZ * z,
                    screenClipRect
                });
            }
        }
    }

    textureHorizontalSpan({
        y,
        left,
        right,
        colorTable,
        texture,
        textureLeftX,
        textureLeftY,
        textureRightX,
        textureRightY,
        screenClipRect,
    }: HorizontalSpan): void {
        const texels = texture.data;

        // multiply to pre shift the u part
        let u = textureLeftX * texture.width * texture.height;
        let v = textureLeftY * texture.height;

        // multiply to pre shift the u part
        const endU = textureRightX * texture.width * texture.height;
        const endV = textureRightY * texture.height;

        const du = (endU - u) / (right - left);
        const dv = (endV - v) / (right - left);

        const uMask = 0 | (texture.width - 1) * texture.height;
        const vMask = 0 | (texture.height - 1);

        const xStart = Math.max(screenClipRect.left, Math.ceil(left));
        const xEnd = Math.min(screenClipRect.right, Math.ceil(right));

        const nudge = xStart - left;
        u += nudge * du;
        v += nudge * dv;

        let offset = this.width * y + xStart;
        for (let x = xStart; x < xEnd; ++x) {
            // const texel = texels[(u & uMask) * texture.width + (v & vMask)];
            // const texel = texels[((u & uMask) << 7) + (v & vMask)];
            const texel = texels[(u & uMask) | (v & vMask)];
            const color = colorTable[texel];
            this.pixels[offset++] = color;
            u += du;
            v += dv;
        }
    }

    landscapeHorizontalSpan({
        y,
        left,
        right,
        colorTable,
        texture,
        textureLeftX,
        textureLeftY,
        textureRightX,
        screenClipRect,
    }: HorizontalSpan): void {
        const texels = texture.data;

        // height left <-> right
        // width top <-> bottom

        let u = textureLeftX * texture.height;
        const endU = textureRightX * texture.height;
        const du = (endU - u) / (right - left);

        const v = Math.max(0, Math.min(texture.width - 1, 0 | (textureLeftY * texture.width)));

        if ((texture.height & (texture.height - 1)) !== 0) {
            throw new Error('landscape height not power of two');
        }

        const uMask = texture.height - 1;
        const rowStart = texture.height * v;

        const xStart = Math.max(screenClipRect.left, Math.ceil(left));
        const xEnd = Math.min(screenClipRect.right, Math.ceil(right));

        const nudge = xStart - left;
        u += nudge * du;

        let offset = this.width * y + xStart;

        for (let x = xStart; x < xEnd; ++x) {
            const texel = texels[rowStart + (uMask & u)];
            const color = colorTable[texel];
            this.pixels[offset++] = color;
            u += du;
        }
    }
}
