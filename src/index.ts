"use strict";

import { HttpFile } from './files/binary-read';
import { Shapes } from './shapes-loader';
import {
    readMapSummaries,
    readMapFromSummary,
    MapSummary
} from './files/wad';
import { Environment } from './environment';

// const shapesUrl = 'minf.shpA';
// const mapUrl = 'minf.sceA';
// const mapUrl = 'NEFX - Minotransformation.sceA';
// const mapUrl = 'XCT2k310.sceA';
// const mapUrl = 'NoCircles.sceA';

// const shapesUrl = 'm2.shpA';
// const mapUrl = 'm2.sceA';

// const shapesUrl = 'Eternal-Shapes.shpA';
// const mapUrl = 'Eternal-Maps.sceA';

const shapesUrl = 'Phoenix Shapes.shpA';
const mapUrl = 'Phoenix Map.sceA';
// const mapUrl = 'Ashen_Map.sceA';

// const shapesUrl = 'Megiddo Shapes.shpA';
// const mapUrl = 'Megiddo Map.sceA';

// const shapesUrl = 'Rubicon Shapes.shpA';
// const mapUrl = 'Rubicon Map.sceA';

// const shapesUrl = 'Wrk.shpA';
// const mapUrl = 'Wrk.sceA';

interface ExtendedWindow extends Window {
    teleport(poly: number): void
}

declare const window: ExtendedWindow;

function populateLevelSelect(levelSelect: HTMLSelectElement, summaries: MapSummary[]) {
    levelSelect.innerHTML = '';
    summaries.forEach((summary, i) => {
        if (summary && summary?.directoryEntry?.levelName) {
            const option = document.createElement('option');
            option.value = `${i}`;
            option.innerText = summary.directoryEntry.levelName;
            levelSelect.appendChild(option);
        }
    });
}

interface Constructor { new(...args: unknown[]): unknown }

function elementById<T extends Constructor>(id: string, klass: T): InstanceType<T> | null {
    const element = document.getElementById(id);
    if (!element) {
        return null;
    }
    if (element instanceof klass) {
        return element as InstanceType<T>;
    } else {
        throw new Error('dom node not instance of ${klass}');
    }
}

function parseRendererType(name: unknown) {
    if (name === 'webgl2' || name === 'software') {
        return name;
    } else {
        return 'webgl2';
    }
}

interface Size {
    width: number
    height: number
}

function parseScreenSize(size: unknown) {
    const defaultSize = { width: 1024, height: 768 };
    if (typeof size !== 'string') {
        return defaultSize;
    } else {
        const match = size.match(/^(\d+)x(\d+)$/);
        if (match && match[1] && match[2]) {
            return {
                width: Number(match[1]),
                height: Number(match[2])
            };
        } else {
            return defaultSize;
        }
    }
}

function createCanvas(container: HTMLElement, size: Size) {
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    container.appendChild(canvas);
    return canvas;
}

window.addEventListener('load', async () => {
    const levelSelect = elementById('levelSelect', HTMLSelectElement);
    const screenSizeSelect = elementById('screenSizeSelect', HTMLSelectElement);
    const backendSelect = elementById('backendSelect', HTMLSelectElement);
    const canvasContainer = elementById('world', HTMLDivElement);
    const fpsCounter = elementById('fpsCounter', HTMLElement);

    if (!canvasContainer) {
        console.error('no canvas container found');
        return;
    }

    let size = parseScreenSize(screenSizeSelect?.value);
    let canvas = createCanvas(canvasContainer, size);

    const file = new HttpFile(mapUrl);
    const summaries = await readMapSummaries(file);

    const summary = summaries[0];
    const map = await readMapFromSummary(summary);

    const shapes = new Shapes(new HttpFile(shapesUrl));

    const environment = new Environment(
        map,
        shapes,
        canvas,
        fpsCounter,
        parseRendererType(backendSelect?.value || 'software'));
    environment.start();
    //let { cancel } = initWorld(map, shapes, canvas, fpsCounter);

    if (levelSelect) {
        populateLevelSelect(levelSelect, summaries);
        levelSelect.addEventListener('change', async () => {
            //cancel();
            const level = parseInt(levelSelect.value);
            const summary = summaries[level];
            const map = await readMapFromSummary(summary);
            environment.loadMap(map);
            //cancel = initWorld(map, shapes, canvas, fpsCounter).cancel;
        });
    }

    if (backendSelect) {
        backendSelect.addEventListener('change', async () => {
            const backend = parseRendererType(backendSelect?.value);
            canvas.remove();
            canvas = createCanvas(canvasContainer, size);
            environment.setBackendType(backend, canvas);
        });
    }

    const screenSizeChange = () => {
        if (screenSizeSelect) {
            size = parseScreenSize(screenSizeSelect.value);
            canvas.width = size.width;
            canvas.height = size.height;
        }
    };

    if (screenSizeSelect) {
        screenSizeSelect.addEventListener('change', screenSizeChange);
        screenSizeChange();
    }
});
