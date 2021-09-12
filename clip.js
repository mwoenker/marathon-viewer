import {v2add, v2sub, v2scale, v2dot, v2lerp} from './vector.js';
import {v3add, v3sub, v3scale, v3dot, v3lerp} from './vector3.js';
import {lerp} from './utils.js';

export class ClipArea {
    // p1 and p2 are points that lie on opposite bounding lines of view area
    // this.leftPlane and this.rightPlane define the bounding half spaces
    // v2dot(this.leftPlane, p) > 0 and v2dot(this.rightPlane, p) > 0
    constructor(p1, p2) {
        const p1Plane = [-p1[1], p1[0]];
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

    lerp(t, p1, p2) {
        return {
            position: v2lerp(t, p1.position, p2.position),
            texX: lerp(t, p1.texX, p2.texX),
        };
    }

    clipLine(p1, p2) {
        const p1DotLeft = v2dot(p1.position, this.leftPlane);
        const p2DotLeft = v2dot(p2.position, this.leftPlane);

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
        
        const p1DotRight = v2dot(p1.position, this.rightPlane);
        const p2DotRight = v2dot(p2.position, this.rightPlane);

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

const emptyPolygon = [];

export class ClipArea3d {
    constructor(planes) {
        this.planes = planes;
    }

    static fromPolygon(polygon) {
        // project points of polygon onto z=1 plane and construct four planes containing
        // the polygon. These planes clip the polygons in view space, but end up effectively
        // clipping an orthogonal rectangle in screen space
        const projectedX = polygon.map((position) => position[0] / position[2]);
        const projectedY = polygon.map((position) => position[1] / position[2]);
        const left = Math.min(...projectedX);
        const right = Math.max(...projectedX);
        const top = Math.min(...projectedY);
        const bottom = Math.max(...projectedY);
        return new ClipArea3d([
            [1, 0, -left],
            [-1, 0, right],
            [0, 1, -top],
            [0, -1, bottom],
        ]);
    }

    static from2dPoints(p1Short, p2Short) {
        const p1 = [p1Short[0], 0, p1Short[1]];
        const p2 = [p2Short[0], 0, p2Short[1]];
        let leftPlane, rightPlane;
        const p1Plane = [-p1[2], 0, p1[0]];
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
    
    clipPolygonByPlane(polygon, plane) {
        let allIn = true;
        let allOut = true;
        const distances = polygon.map(position => {
            const dist =  v3dot(position, plane);
            if (dist < 0) {
                allIn = false;
            } else if (dist >= 0) {
                allOut = false;
            }
            return dist;
        });

        if (allOut) {
            return [];
        } else if (allIn) {
            return polygon;
        } else {
            const result = [];
            for (let i = 0; i < polygon.length; ++i) {
                const nextI = (i + 1) % polygon.length;
                if (distances[i] >= 0) {
                    result.push(polygon[i]);
                    if (distances[nextI] < 0) {
                        const t = distances[i] / (distances[i] - distances[nextI]);
                        result.push(v3lerp(t, polygon[i], polygon[nextI]));
                    }
                } else {
                    if (distances[nextI] >= 0) {
                        const t = distances[i] / (distances[i] - distances[nextI]);
                        result.push(v3lerp(t, polygon[i], polygon[nextI]));
                    }
                }
            }
            return result;
        }
    }

    clipPolygon(polygon) {
        const distances = new Array(polygon);
        for (const plane of this.planes) {
            polygon = this.clipPolygonByPlane(polygon, plane);
        }
        return polygon;
    }
}

