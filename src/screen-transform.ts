import { lerp } from './utils';
import { Vec3 } from './vector3';

export class ScreenTransform {
    width: number;
    height: number;
    left: number;
    right: number
    top: number;
    bottom: number;
    xScale: number;
    yScale: number;

    constructor(width: number, height: number, hFov: number, vFov: number, verticalAngle: number) {
        this.width = width;
        this.height = height;
        this.left = -Math.tan(hFov / 2);
        this.right = Math.tan(hFov / 2);
        const middle = Math.tan(verticalAngle);
        this.top = middle + Math.tan(vFov / 2);
        this.bottom = middle - Math.tan(vFov / 2);
        this.xScale = this.width / (this.right - this.left);
        this.yScale = this.height / (this.bottom - this.top);
    }

    viewXToColumn(x: number, z: number): number {
        return this.xScale * (x / z - this.left);
    }

    viewYToRow(y: number, z: number): number {
        const projected = y / z;
        return this.yScale * (projected - this.top);
    }

    viewToScreen([x, y, z]: Vec3): Vec3 {
        return [this.viewXToColumn(x, z), this.viewYToRow(y, z), z];
    }

    screenToRay(x: number, y: number): Vec3 {
        return [
            lerp(x / this.width, this.left, this.right),
            lerp(y / this.height, this.top, this.bottom),
            1,
        ];
    }
}
