import { Vec2 } from './vector2';
import { worldUnitSize } from './constants';

export const playerHeight = Math.floor(worldUnitSize * 0.66);

export interface Player {
    position: Vec2;
    polygon: number;
    facingAngle: number;
    verticalAngle: number;
    hFov: number;
    vFov: number;
    wallBitmapIndex: number;
    height: number;
    secondsElapsed: number,
}
