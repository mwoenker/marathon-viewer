import { lerp, floorMod } from './utils';
import { makeShadingTables, magenta, shadingTableForDistance, black } from './color.js';
import { transferMode } from './files/wad.js';
import { ScreenTransform } from './screen-transform.js';

export class Rasterizer {
    constructor(width, height, pixels, player) {
        this.pixels = pixels;
        this.screenTransform = new ScreenTransform(width, height, player.hFov, player.vFov, player.verticalAngle);
        this.width = width;
        this.height = height;

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

    drawWall({ polygon, texture, brightness, transfer, isTransparent }) {
        if (transfer === transferMode.landscape) {
            this.textureHorizontalPolygon({ polygon, texture, brightness, transfer });
        } else {
            this.textureWall({ polygon, texture, brightness, transfer, isTransparent });
        }
    }

    textureWall({ polygon, texture, brightness, transfer, isTransparent = false }) {
        if (!texture) {
            return;
        }

        const screenPosition = polygon.map(({ position }) =>
            this.screenTransform.viewToScreen(position));
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
        this.textureWallRange(xMin, xMax, texture, brightness, isTransparent);
    }

    textureWallRange(xMin, xMax, texture, brightness, isTransparent) {
        for (let x = xMin; x < xMax; ++x) {
            const topParams = this.topParamList[x];
            const bottomParams = this.bottomParamList[x];
            const z = 1 / topParams.oneOverZ;
            const shadingTable = shadingTableForDistance(texture.shadingTables, z, brightness);

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
                });
            }
        }
    }

    textureWallSlice({ x, top, bottom, colorTable, texXOffset, texture, textureTop, textureBottom }) {
        const intTop = Math.max(0, parseInt(Math.ceil(top)));
        const intBottom = Math.min(this.height, parseInt(Math.ceil(bottom)));
        const texels = texture.data;

        let offset = x + this.width * intTop;
        const increment = this.width;
        const texelX = floorMod(parseInt(texXOffset * texture.width), 128);
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

    textureWallSliceTransparent({ x, top, bottom, colorTable, texXOffset, texture, textureTop, textureBottom }) {
        const intTop = Math.max(0, parseInt(Math.ceil(top)));
        const intBottom = Math.min(this.height, parseInt(Math.ceil(bottom)));
        const texels = texture.data;

        let offset = x + this.width * intTop;
        const increment = this.width;
        const texelX = floorMod(parseInt(texXOffset * texture.width), 128);
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

    drawHorizontalPolygon({ polygon, texture, brightness, transfer }) {
        this.textureHorizontalPolygon({ polygon, texture, brightness, transfer });
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

    textureHorizontalPolygon({ polygon, texture, brightness, transfer }) {
        if (!texture) {
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
        this.textureHorizontalRange(yMin, yMax, texture, brightness, transfer);
    }

    textureHorizontalRange(yMin, yMax, texture, brightness, transfer) {
        for (let y = yMin; y < yMax; ++y) {
            const leftParams = this.leftParamList[y];
            const rightParams = this.rightParamList[y];
            const z = 1 / leftParams.oneOverZ;

            if (transfer === transferMode.landscape) {
                const shadingTable = shadingTableForDistance(texture.shadingTables, 0, 1);
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
                    transfer,
                });
            } else {
                const shadingTable = shadingTableForDistance(texture.shadingTables, z, brightness);
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
                    transfer,
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
        transfer
    }) {
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

        const xStart = Math.ceil(left);
        const xEnd = Math.ceil(right);

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
        textureRightY,
        transfer
    }) {
        const texels = texture.data;

        // height left <-> right
        // width top <-> bottom

        let u = textureLeftX * texture.height;
        const endU = textureRightX * texture.height;
        const du = (endU - u) / (right - left);

        let v = Math.max(0, Math.min(texture.width - 1, 0 | (textureLeftY * texture.width)));

        if (texture.height & (texture.height - 1) !== 0) {
            throw new Error('landscape height not power of two');
        }

        const uMask = texture.height - 1;
        const rowStart = texture.height * v;

        const xStart = Math.ceil(left);
        const xEnd = Math.ceil(right);

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
