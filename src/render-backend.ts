import { impossibleValue } from './utils';
import { ShapeTextures } from './gl/shape-textures';
import { Shapes } from './shapes-loader';
import { SoftwareRasterizer } from './rasterize';
import { Rasterizer as GL2Rasterizer } from './gl/rasterize';
import { Player } from './player';
import { magenta } from './color';
import { render } from './render';
import { World } from './world';
import { Shader } from './gl/shaders';

class SoftwareRenderBackend {
    private canvas: HTMLCanvasElement
    private shapeLoader: Shapes
    private context: CanvasRenderingContext2D
    private imageData: ImageData
    private pixels: Uint32Array

    constructor(canvas: HTMLCanvasElement, shapeLoader: Shapes) {
        this.canvas = canvas;
        this.shapeLoader = shapeLoader;
        const context = canvas.getContext('2d');

        if (!context) {
            throw new Error("Can't get 2D canvas context");
        }

        this.context = context;
        this.imageData = context.createImageData(canvas.width, canvas.height);
        this.pixels = new Uint32Array(this.imageData.data.buffer);
    }

    frame({ player, world, seconds }: RenderFrameData): void {
        this.pixels.fill(magenta);

        this.context.fillStyle = 'white';
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const rasterizer = new SoftwareRasterizer(
            this.canvas.width,
            this.canvas.height,
            this.pixels,
            player,
            this.shapeLoader
        );

        render({ rasterizer, player, world, seconds });

        this.context.putImageData(this.imageData, 0, 0);
    }

    dispose(): void {
        // nothing to do
    }
}

class WebGL2RenderBackend {
    private canvas: HTMLCanvasElement
    private context: WebGL2RenderingContext
    private shapeTextures: ShapeTextures
    private shader: Shader

    constructor(canvas: HTMLCanvasElement, shapeLoader: Shapes) {
        this.canvas = canvas;
        const context = canvas.getContext('webgl2');

        if (!context) {
            throw new Error("Can't get webgl2 context. Please get a new computer");
        }

        this.context = context;
        this.shapeTextures = new ShapeTextures(context, shapeLoader);
        this.shader = new Shader(this.context);
    }

    frame({ player, world, seconds }: RenderFrameData): void {
        const gl = this.context;

        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0.0, 1.0, 1.0, 1.0);
        gl.clearDepth(1.0);

        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.disable(gl.DEPTH_TEST);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        const rasterizer = new GL2Rasterizer(
            player, gl, this.shapeTextures, this.shader);
        render({ rasterizer, player, world, seconds });
        rasterizer.flush();
        rasterizer.dispose();
    }

    dispose(): void {
        this.shapeTextures.dispose();
        this.shader.dispose();
    }
}

type RenderBackend = SoftwareRenderBackend | WebGL2RenderBackend;
export type RendererType = 'software' | 'webgl2'

export interface RenderTargetData {
    type: RendererType,
    canvas: HTMLCanvasElement,
    shapeLoader: Shapes
}

export interface RenderFrameData {
    player: Player
    world: World
    seconds: number
}

// Any time you see something named "manager" you know the programmer is out of
// ideas for names
export class RenderManager {
    private canvas?: HTMLCanvasElement
    private shapeLoader?: Shapes
    private width?: number
    private height?: number
    private type?: RendererType
    private backend?: RenderBackend

    private shouldReinitialize(target: RenderTargetData) {
        return !this.backend ||
            this.width !== target.canvas.width ||
            this.height !== target.canvas.height ||
            this.type !== target.type ||
            this.canvas !== target.canvas ||
            this.shapeLoader !== target.shapeLoader;
    }

    private getBackend(target: RenderTargetData) {
        if (this.backend && !this.shouldReinitialize(target)) {
            return this.backend;
        } else {
            if (this.backend) {
                this.backend.dispose();
            }

            this.canvas = target.canvas;
            this.shapeLoader = target.shapeLoader;
            this.width = target.canvas.width;
            this.height = target.canvas.height;
            this.type = target.type;

            if (target.type === 'software') {
                this.backend = new SoftwareRenderBackend(target.canvas, target.shapeLoader);
                return this.backend;
            } else if (target.type === 'webgl2') {
                this.backend = new WebGL2RenderBackend(target.canvas, target.shapeLoader);
                return this.backend;
            } else {
                impossibleValue(target.type);
            }
        }
    }

    frame(target: RenderTargetData, frameData: RenderFrameData): void {
        const backend = this.getBackend(target);
        backend.frame(frameData);
    }
}

