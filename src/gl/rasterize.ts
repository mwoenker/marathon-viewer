import { Vec3 } from '../vector3';
import { TransferMode } from '../files/wad';
import { ScreenTransform } from '../screen-transform';
import { errorName } from './error-name';
import { getShaderProgram } from './shaders';
import { RenderPolygonProps } from '../rasterize';
import { Shapes } from '../shapes-loader';
import { ShapeTextures } from './shape-textures';
import { GeometryBuffer } from './geometry-buffer';

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

export class Rasterizer {
    screenTransform: ScreenTransform;
    width: number;
    height: number;
    topParamList: VerticalPolyLineParams[];
    bottomParamList: VerticalPolyLineParams[];
    leftParamList: HorizontalPolyLineParams[];
    rightParamList: HorizontalPolyLineParams[];
    geometryBuffer: GeometryBuffer

    constructor(player: PlayerProps, gl: WebGL2RenderingContext, shapeTextures: ShapeTextures) {
        this.geometryBuffer = new GeometryBuffer(gl, shapeTextures);
        const width = 1;
        const height = 1;

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

    drawWall(props: RenderPolygonProps): void {
        if (props.transfer === TransferMode.landscape || props.transfer == TransferMode.static) {
            this.textureHorizontalPolygon(props);
        } else {
            this.textureWall(props);
        }
    }

    flush(isFinal = false): void {
        this.geometryBuffer.flush(isFinal);
    }

    textureWall(
        { polygon, textureDescriptor, brightness, isTransparent = false }: RenderPolygonProps
    ): void {
        const transformed = polygon.map(({ position, texCoord }) => ({
            position: this.screenTransform.viewToScreen(position),
            texCoord
        }));
        this.geometryBuffer.addPolygon(textureDescriptor, transformed, brightness);
    }

    drawHorizontalPolygon({ polygon, textureDescriptor, brightness, transfer }: RenderPolygonProps): void {
        this.textureHorizontalPolygon({ polygon, textureDescriptor, brightness, transfer });
    }

    textureHorizontalPolygon({ polygon, textureDescriptor, brightness, transfer }: RenderPolygonProps): void {
        const transformed = polygon.map(({ position, texCoord }) => ({
            position: this.screenTransform.viewToScreen(position),
            texCoord
        }));
        this.geometryBuffer.addPolygon(textureDescriptor, transformed, brightness);
    }
}
