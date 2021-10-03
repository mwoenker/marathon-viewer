import {
    v2add,
    v2sub,
    v2dot,
    Vec2,
} from './vector2';

export class Transformation {
    newOrigin: Vec2;
    xAxis: Vec2;
    yAxis: Vec2;
    oldXAxis: Vec2;
    oldYAxis: Vec2;

    constructor(newOrigin: Vec2, rotation: number) {
        this.newOrigin = newOrigin;
        this.xAxis = [-Math.sin(rotation), Math.cos(rotation)];
        this.yAxis = [Math.cos(rotation), Math.sin(rotation)];

        this.oldXAxis = [-Math.sin(rotation), Math.cos(rotation)];
        this.oldYAxis = [Math.cos(rotation), Math.sin(rotation)];
    }

    transform(v: Vec2): Vec2 {
        const translated = v2sub(v, this.newOrigin);
        return [v2dot(translated, this.xAxis), v2dot(translated, this.yAxis)];
    }

    unTransform(v: Vec2): Vec2 {
        const translated: Vec2 = [v2dot(v, this.oldXAxis), v2dot(v, this.oldYAxis)];
        return v2add(translated, this.newOrigin);
    }
}

