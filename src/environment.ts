import { MapGeometry } from './files/map';
import { Shapes } from './shapes-loader';
import { Player } from './player';
import { World } from './world';
import { v2add, v2direction, v2scale, v2 } from './vector2';
import { RendererType, RenderFrameData, RenderManager, RenderTargetData } from './render-backend';
import { keyMap } from './events';
import { textureClickedSurface } from './texturing';
import { worldUnitSize } from './constants';

const hFov = 90 / 180 * Math.PI;

interface ExtendedWindow extends Window {
    teleport?(poly: number): void
}

declare const window: ExtendedWindow;

type KeyboardHandler = (e: KeyboardEvent) => void
type MouseHandler = (e: MouseEvent) => void

function makePlayer(world: World, canvas: HTMLCanvasElement) {
    const { polygon, position, height, facing } =
        world.playerStartPosition();
    const vFov = 2 * Math.atan(Math.tan(hFov / 2)
        * canvas.height / canvas.width);
    return {
        position,
        polygon,
        facingAngle: facing,
        verticalAngle: 0.0,
        hFov,
        vFov,
        wallBitmapIndex: 31,
        height,
        secondsElapsed: 0,
    };
}

export class Environment {
    map: MapGeometry
    world: World
    shapes: Shapes
    canvas: HTMLCanvasElement
    fpsCounter: HTMLElement | null
    running = false
    player: Player
    actions: Set<string> = new Set()
    renderManager: RenderManager
    startTime: number
    fpsCounterBegin: number
    fpsCounted: number
    lastFrameTime: number
    lastPoly: number
    backendType: RendererType = 'software'

    keydown: KeyboardHandler | null = null
    keyup: KeyboardHandler | null = null
    clicked: MouseHandler | null = null

    constructor(
        map: MapGeometry,
        shapes: Shapes,
        canvas: HTMLCanvasElement,
        fpsCounter: HTMLElement | null,
        backend: RendererType
    ) {
        this.map = map;
        this.shapes = shapes;
        this.canvas = canvas;
        this.fpsCounter = fpsCounter;

        this.world = new World(map);
        this.player = makePlayer(this.world, canvas);

        this.renderManager = new RenderManager();
        this.startTime = Date.now();
        this.fpsCounterBegin = Date.now();
        this.fpsCounted = 0;
        this.lastFrameTime = 0;
        this.lastPoly = this.player.polygon;
        this.backendType = backend;
    }

    start(): void {
        this.setupWindowFunctions();
        this.setupEvents();
        this.running = true;
        const frame = () => {
            this.frame();
            if (this.actions.has('quit')) {
                this.running = false;
            }
            if (this.running) {
                requestAnimationFrame(frame);
            }
        };
        requestAnimationFrame(frame);
    }

    stop(): void {
        this.running = false;
        this.teardownWindowFunctions();
        this.teardownEvents();
    }

    loadMap(map: MapGeometry): void {
        this.map = map;
        this.world = new World(map);
        this.player = makePlayer(this.world, this.canvas);
    }

    setBackendType(backend: RendererType, newCanvas: HTMLCanvasElement): void {
        this.canvas = newCanvas;
        this.backendType = backend;
    }

    private update(timeSlice: number, secondsElapsed: number) {
        if (!this.lastFrameTime) {
            return;
        }

        if (this.lastPoly !== this.player.polygon) {
            console.log('poly', this.player.polygon);
            this.lastPoly = this.player.polygon;
        }

        let { position, height, polygon, facingAngle, verticalAngle } = this.player;
        const forward = v2direction(facingAngle);
        const left = v2direction(facingAngle - Math.PI / 2);
        const oldPosition = position;
        this.world.advanceTimeSlice(timeSlice);

        if (this.actions.has('forward')) {
            position = v2add(position, v2scale(timeSlice * 4 * worldUnitSize, forward));
        }

        if (this.actions.has('backward')) {
            position = v2add(position, v2scale(-timeSlice * 4 * worldUnitSize, forward));
        }

        if (this.actions.has('turn-left')) {
            facingAngle = facingAngle - timeSlice * 4;
        }

        if (this.actions.has('turn-right')) {
            facingAngle = facingAngle + timeSlice * 4;
        }

        if (this.actions.has('strafe-left')) {
            position = v2add(position, v2scale(timeSlice * 2 * worldUnitSize, left));
        }

        if (this.actions.has('strafe-right')) {
            position = v2add(position, v2scale(-timeSlice * 2 * worldUnitSize, left));
        }

        if (this.actions.has('up')) {
            height += timeSlice * 4 * worldUnitSize;
        }

        if (this.actions.has('down')) {
            height -= timeSlice * 4 * worldUnitSize;
        }

        if (this.actions.has('tilt-up')) {
            verticalAngle = Math.min(Math.PI / 6, verticalAngle + timeSlice * 2);
        }

        if (this.actions.has('tilt-down')) {
            verticalAngle = Math.max(-Math.PI / 6, verticalAngle - timeSlice * 2);
        }

        const newPosition = this.world.movePlayer(oldPosition, position, polygon);
        if (newPosition) {
            [position, polygon] = newPosition;
        } else {
            position = oldPosition;
        }

        this.player = {
            ...this.player,
            position,
            height,
            polygon,
            facingAngle,
            secondsElapsed,
            verticalAngle
        };
    }

    private draw(secondsElapsed: number) {
        const targetData: RenderTargetData = {
            type: this.backendType,
            canvas: this.canvas,
            shapeLoader: this.shapes
        };
        const frameData: RenderFrameData = {
            player: this.player,
            world: this.world,
            seconds: secondsElapsed
        };
        this.renderManager.frame(targetData, frameData);

    }

    private updateFpsCounter(frameTime: number) {
        ++this.fpsCounted;

        if (frameTime - this.fpsCounterBegin > 1000) {
            const secondsElapsed = (frameTime - this.fpsCounterBegin) / 1000;
            const fps = this.fpsCounted / secondsElapsed;
            this.fpsCounted = 0;
            this.fpsCounterBegin = (new Date()).getTime();

            if (this.fpsCounter) {
                this.fpsCounter.innerText = `${fps} fps`;
            }
        }

        this.lastFrameTime = frameTime;
    }

    private frame() {
        const frameTime = (new Date()).getTime();
        const timeSlice = (frameTime - this.lastFrameTime) / 1000;
        const secondsElapsed = (frameTime - this.startTime) / 1000;

        this.update(timeSlice, secondsElapsed);
        this.draw(secondsElapsed);
        this.updateFpsCounter(frameTime);
    }

    private setupWindowFunctions() {
        window.teleport = (polyIndex) => {
            const sum = this.map.polygons[polyIndex].endpoints.reduce(
                (sum, pointIndex) => v2add(sum, this.map.points[pointIndex]),
                v2(0, 0),
            );
            const average = v2scale(1 / this.map.polygons[polyIndex].endpoints.length, sum);
            this.player.polygon = polyIndex;
            this.player.position = average;
            this.player.height = this.map.polygons[polyIndex].floorHeight + 0.66;
        };
    }

    private setupEvents() {
        this.actions.clear();

        this.keydown = (e: KeyboardEvent) => {
            const action = keyMap[e.key];
            if (action) {
                e.preventDefault();
                this.actions.add(action);
            }
        };

        this.keyup = (e: KeyboardEvent) => {
            const action = keyMap[e.key];
            if (action) {
                e.preventDefault();
                this.actions.delete(action);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.actions.add('quit'); // sticky, doesn't go away
            }
        };

        this.clicked = (e) => {
            this.map = textureClickedSurface(
                this.canvas,
                this.player,
                this.world,
                this.map,
                e.offsetX,
                e.offsetY);
        };

        window.addEventListener('keydown', this.keydown);
        window.addEventListener('keyup', this.keyup);

        this.canvas.addEventListener('mousedown', this.clicked);
    }

    private teardownEvents() {
        if (this.keyup) {
            window.removeEventListener('keyup', this.keyup);
            this.keyup = null;
        }

        if (this.keydown) {
            window.removeEventListener('keydown', this.keydown);
            this.keydown = null;
        }

        if (this.clicked) {
            window.removeEventListener('click', this.clicked);
            this.clicked = null;
        }
    }

    private teardownWindowFunctions() {
        delete window.teleport;
    }
}
