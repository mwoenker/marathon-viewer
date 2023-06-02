import { TransferMode } from '../files/wad';
import { ScreenTransform } from '../screen-transform';
import { RenderPolygonProps } from '../rasterize';
import { ShapeTextures } from './shape-textures';
import { GeometryBuffer } from './geometry-buffer';
import { Shader } from './shaders';

interface PlayerProps {
    hFov: number;
    vFov: number;
    verticalAngle: number
}

export class Rasterizer {
    screenTransform: ScreenTransform;
    width: number;
    height: number;
    geometryBuffer: GeometryBuffer

    constructor(
        player: PlayerProps,
        gl: WebGL2RenderingContext,
        shapeTextures: ShapeTextures,
        shader: Shader
    ) {
        this.geometryBuffer = new GeometryBuffer(gl, shapeTextures, shader);
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
    }

    drawWall(props: RenderPolygonProps): void {
        if (props.transfer === TransferMode.landscape || props.transfer == TransferMode.static) {
            this.textureHorizontalPolygon(props);
        } else {
            this.textureWall(props);
        }
    }

    flush(): void {
        this.geometryBuffer.flush();
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
        const realBrightness = transfer === TransferMode.landscape ? 1.0 : brightness;
        this.geometryBuffer.addPolygon(textureDescriptor, transformed, realBrightness);
    }

    dispose(): void {
        this.geometryBuffer.dispose();
    }
}
