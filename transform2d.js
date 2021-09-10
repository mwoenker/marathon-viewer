import {
    v2add,
    v2sub,
    v2dot,
} from './vector.js';

export class Transformation {
    constructor(newOrigin, rotation) {
        this.newOrigin = newOrigin;
        this.xAxis = [-Math.sin(rotation), Math.cos(rotation)];
        this.yAxis = [Math.cos(rotation), Math.sin(rotation)];

        this.oldXAxis = [-Math.sin(rotation), Math.cos(rotation)];
        this.oldYAxis = [Math.cos(rotation), Math.sin(rotation)];
    }

    transform(v) {
        const translated = v2sub(v, this.newOrigin);
        return [v2dot(translated, this.xAxis), v2dot(translated, this.yAxis)];
    }

    unTransform(v)  {
        const translated = [v2dot(v, this.oldXAxis), v2dot(v, this.oldYAxis)];
        return v2add(translated, this.newOrigin);
    }
}

