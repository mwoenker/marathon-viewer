import { Vec2 } from '../vector2';

export class Viewport {
    height: number;
    width: number;
    pixelSize: number;
    viewCenter: Vec2;
    left: number;
    right: number;
    top: number;
    bottom: number;

    constructor(width: number, height: number, pixelSize: number, viewCenter: Vec2) {
        this.height = height;
        this.width = width;
        this.pixelSize = pixelSize;
        this.viewCenter = viewCenter;
        // edges of viewport in world coords
        this.left = viewCenter[0] - (width / 2 * pixelSize);
        this.top = viewCenter[1] - (height / 2 * pixelSize);
        this.right = viewCenter[0] + (width / 2 * pixelSize);
        this.bottom = viewCenter[1] + (height / 2 * pixelSize);
    }
    toPixel(p: Vec2): Vec2 {
        const [x, y] = p;
        const { left, top, pixelSize } = this;
        return [(x - left) / pixelSize, (y - top) / pixelSize];
    }
    toWorld(p: Vec2): Vec2 {
        const [x, y] = p;
        const { left, top, pixelSize } = this;
        return [x * pixelSize + left, y * pixelSize + top];
    }
}

