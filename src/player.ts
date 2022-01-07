import { Vec2 } from './vector2';

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
