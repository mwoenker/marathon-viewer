import { Reader, Writer } from '../binary-read';
import { Vec2, v2direction, v2scale, v2add } from '../../vector2';
import { readPoint, writePoint } from './utils';
import { fromFixedAngle } from '../../world';

interface MediaConstructor {
    type: number;
    flags: number;
    lightIndex: number;
    currentDirection: number;
    currentMagnitude: number;
    low: number;
    high: number;
    origin: Vec2;
    height: number;
    minimumLightIntensity: number;
    texture: number;
    transferMode: number;
}

export class Media {
    type: number;
    flags: number;
    lightIndex: number;
    currentDirection: number;
    currentMagnitude: number;
    low: number;
    high: number;
    origin: Vec2;
    height: number;
    minimumLightIntensity: number;
    texture: number;
    transferMode: number;

    constructor(data: MediaConstructor) {
        this.type = data.type;
        this.flags = data.flags;
        this.lightIndex = data.lightIndex;
        this.currentDirection = data.currentDirection;
        this.currentMagnitude = data.currentMagnitude;
        this.low = data.low;
        this.high = data.high;
        this.origin = data.origin;
        this.height = data.height;
        this.minimumLightIntensity = data.minimumLightIntensity;
        this.texture = data.texture;
        this.transferMode = data.transferMode;
    }

    static read(reader: Reader): Media {
        const media = new Media({
            type: reader.int16(),
            flags: reader.uint16(),
            lightIndex: reader.int16(),
            currentDirection: reader.int16(),
            currentMagnitude: reader.int16(),
            low: reader.int16(),
            high: reader.int16(),
            origin: readPoint(reader),
            height: reader.int16(),
            minimumLightIntensity: reader.int32(), // fixed point
            texture: reader.uint16(), // shape descriptor
            transferMode: reader.int16(),
        });
        reader.skip(4);
        return media;
    }

    write(writer: Writer): void {
        writer.int16(this.type);
        writer.uint16(this.flags);
        writer.int16(this.lightIndex);
        writer.int16(this.currentDirection);
        writer.int16(this.currentMagnitude);
        writer.int16(this.low);
        writer.int16(this.high);
        writePoint(writer, this.origin);
        writer.int16(this.height);
        writer.int32(this.minimumLightIntensity);
        writer.uint16(this.texture);
        writer.int16(this.transferMode);
        writer.zeros(4);
    }

    originAtTime(elapsedSeconds: number): Vec2 {
        const dirRadians = fromFixedAngle(this.currentDirection);
        const dirVec: Vec2 = v2scale(this.currentMagnitude, v2direction(dirRadians));
        const ticksElapsed = 30 * elapsedSeconds;
        return v2add(this.origin, v2scale(ticksElapsed, dirVec));
    }
}
