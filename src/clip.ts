import { Vec2, v2scale, v2dot, v2lerp, v2 } from './vector2';
import { Vec3, v3scale, v3dot, v3lerp } from './vector3';

export class ClipArea {
    leftPlane: Vec2
    rightPlane: Vec2

    // p1 and p2 are points that lie on opposite bounding lines of view area
    // this.leftPlane and this.rightPlane define the bounding half spaces
    // v2dot(this.leftPlane, p) > 0 and v2dot(this.rightPlane, p) > 0
    constructor(p1: Vec2, p2: Vec2) {
        const p1Plane = v2(-p1[1], p1[0]);
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

export class ClipArea3d {
    planes: Vec3[]

    constructor(planes: Vec3[]) {
        this.planes = planes;
    }

    static fromPolygon(polygon: Vec3[]): ClipArea3d {
        // project points of polygon onto z=1 plane and construct four planes containing
        // the polygon. These planes clip the polygons in view space, but end up effectively
        // clipping an orthogonal rectangle in screen space
        let left = polygon[0][0] / polygon[0][2];
        let right = left;
        let top = polygon[0][1] / polygon[0][2];
        let bottom = top;
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
            if (projectedY < top) {
                top = projectedY;
            }
            if (projectedY > bottom) {
                bottom = projectedY;
            }
        }
        return new ClipArea3d([
            [1, 0, -left],
            [-1, 0, right],
            [0, 1, -top],
            [0, -1, bottom],
        ]);
    }

    static from2dPoints(p1Short: Vec2, p2Short: Vec2): ClipArea3d {
        const p1: Vec3 = [p1Short[0], 0, p1Short[1]];
        const p2: Vec3 = [p2Short[0], 0, p2Short[1]];
        let leftPlane: Vec3, rightPlane: Vec3;
        const p1Plane: Vec3 = [-p1[2], 0, p1[0]];
        if (v3dot(p1Plane, p2) > 0) {
            // line from origin to p2 defines the left edge of the area
            leftPlane = [p2[2], 0, -p2[0]];
            rightPlane = p1Plane;
        } else {
            // line from origin to p1 defines left edge
            leftPlane = v3scale(-1, p1Plane);
            rightPlane = [-p2[2], 0, p2[0]];
        }
        return new ClipArea3d([leftPlane, rightPlane]);
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
        let allIn = true;
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
            return polygon;
        }

        for (const plane of this.planes) {
            polygon = this.clipPolygonByPlane(polygon, plane);
        }
        return polygon;
    }
}

