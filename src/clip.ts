import { Vec2, v2scale, v2dot, v2lerp } from './vector2';
import { Vec3, v3scale, v3dot, v3lerp } from './vector3';
import { ScreenTransform } from './screen-transform';

export interface ScreenClipRect {
    left: number;
    right: number
    top: number;
    bottom: number;
}

export class ClipArea {
    leftPlane: Vec2
    rightPlane: Vec2

    // p1 and p2 are points that lie on opposite bounding lines of view area
    // this.leftPlane and this.rightPlane define the bounding half spaces
    // v2dot(this.leftPlane, p) > 0 and v2dot(this.rightPlane, p) > 0
    constructor(p1: Vec2, p2: Vec2) {
        const p1Plane: Vec2 = [-p1[1], p1[0]];
        if (v2dot(p1Plane, p2) > 0) {
            // line from origin to p2 defines the left edge of the area
            this.leftPlane = [p2[1], -p2[0]];
            this.rightPlane = p1Plane;
        } else {
            // line from origin to p1 defines left edge
            this.leftPlane = v2scale(-1, p1Plane);
            this.rightPlane = [-p2[1], p2[0]];
        }
    }

    lerp(t: number, p1: Vec2, p2: Vec2): Vec2 {
        return v2lerp(t, p1, p2);
    }

    clipLine(p1: Vec2, p2: Vec2): [Vec2, Vec2] | null {
        const p1DotLeft = v2dot(p1, this.leftPlane);
        const p2DotLeft = v2dot(p2, this.leftPlane);

        if (p1DotLeft < 0 && p2DotLeft < 0) {
            return null;
        } else {
            if (p1DotLeft < 0) {
                const t = p1DotLeft / (p1DotLeft - p2DotLeft);
                p1 = this.lerp(t, p1, p2);
            } else if (p2DotLeft < 0) {
                const t = p2DotLeft / (p2DotLeft - p1DotLeft);
                p2 = this.lerp(t, p2, p1);
            }
        }

        const p1DotRight = v2dot(p1, this.rightPlane);
        const p2DotRight = v2dot(p2, this.rightPlane);

        if (p1DotRight < 0 && p2DotRight < 0) {
            return null;
        } else {
            if (p1DotRight < 0) {
                const t = p1DotRight / (p1DotRight - p2DotRight);
                p1 = this.lerp(t, p1, p2);
            } else if (p2DotRight < 0) {
                const t = p2DotRight / (p2DotRight - p1DotRight);
                p2 = this.lerp(t, p2, p1);
            }

            return [p1, p2];
        }
    }
}

let n = 0;

export class ClipArea3d {
    planes: Vec3[]
    left: number;
    right: number;
    top: number;
    bottom: number;

    constructor(left: number, right: number, top: number, bottom: number) {
        this.left = left;
        this.right = right;
        this.top = top;
        this.bottom = bottom;
        // console.log({ left, right, top, bottom });
        this.planes = [
            [1, 0, -left],
            [-1, 0, right],
            [0, 1, -bottom],
            [0, -1, top],
        ]
    }

    screenClipRect(screenTransform: ScreenTransform): ScreenClipRect {
        const margin = 0;
        return {
            left: Math.ceil(screenTransform.viewXToColumn(this.left, 1)) + margin,
            right: Math.ceil(screenTransform.viewXToColumn(this.right, 1)) - margin,
            top: Math.ceil(screenTransform.viewYToRow(this.top, 1)) + margin,
            bottom: Math.ceil(screenTransform.viewYToRow(this.bottom, 1)) - margin,
        }
    }

    static fromPolygon(polygon: Vec3[]): ClipArea3d {
        // project points of polygon onto z=1 plane and construct four planes containing
        // the polygon. These planes clip the polygons in view space, but end up effectively
        // clipping an orthogonal rectangle in screen space

        let left = polygon[0][0] / polygon[0][2];
        let right = left;
        let top = polygon[0][1] / polygon[0][2];
        let bottom = top
        for (let i = 1; i < polygon.length; ++i) {
            const position = polygon[i];
            const projectedX = position[0] / position[2];
            const projectedY = position[1] / position[2];
            if (projectedX < left) {
                left = projectedX;
            }
            if (projectedX > right) {
                right = projectedX;
            }
            if (projectedY > top) {
                top = projectedY;
            }
            if (projectedY < bottom) {
                bottom = projectedY;
            }
        }

        // const projectedX = polygon.map((position) => position[0] / position[2]);
        // const projectedY = polygon.map((position) => position[1] / position[2]);
        // const left = Math.min(...projectedX);
        // const right = Math.max(...projectedX);
        // const top = Math.min(...projectedY);
        // const bottom = Math.max(...projectedY);
        return new ClipArea3d(left, right, top, bottom);
    }

    clipPolygonByPlane(polygon: Vec3[], plane: Vec3): Vec3[] {
        const result = [];
        for (let i = 0; i < polygon.length; ++i) {
            const nextI = (i + 1) % polygon.length;
            const distI = v3dot(polygon[i], plane);
            const distNextI = v3dot(polygon[nextI], plane);
            if (distI >= 0) {
                result.push(polygon[i]);
                if (distNextI < 0) {
                    const t = distI / (distI - distNextI);
                    result.push(v3lerp(t, polygon[i], polygon[nextI]));
                }
            } else {
                if (distNextI >= 0) {
                    const t = distI / (distI - distNextI);
                    result.push(v3lerp(t, polygon[i], polygon[nextI]));
                }
            }
        }
        return result;
    }

    clipPolygon(polygon: Vec3[]): Vec3[] {
        let allIn = true
        for (let planeIndex = 0; planeIndex < this.planes.length; ++planeIndex) {
            let allOut = true;
            for (let polyIndex = 0; polyIndex < polygon.length; ++polyIndex) {
                const dist = v3dot(polygon[polyIndex], this.planes[planeIndex]);
                if (dist > 0) {
                    allOut = false;
                } else {
                    allIn = false;
                }
            }
            if (allOut) {
                return [];
            }
        }

        if (allIn) {
            return polygon
        }

        for (const plane of this.planes) {
            polygon = this.clipPolygonByPlane(polygon, plane);
        }
        return polygon;
    }
}
