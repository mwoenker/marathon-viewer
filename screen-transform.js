import {lerp} from './utils.js';

export class ScreenTransform {
    constructor(width, height, hFov, vFov, verticalAngle) {
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

    viewXToColumn(x, z) {
        return this.xScale * (x / z - this.left);
    }
    
    viewYToRow(y, z) {
        const projected = y / z;
        return this.yScale * (projected - this.top);
    }

    viewToScreen([x, y, z]) {
        return [this.viewXToColumn(x, z), this.viewYToRow(y, z), z];
    }

    screenToRay(x, y) {
        return [
            lerp(x / this.width, this.left, this.right),
            lerp(y / this.height, this.top, this.bottom),
            1,
        ];
    }
}
