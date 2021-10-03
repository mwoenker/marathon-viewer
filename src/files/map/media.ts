import { Reader, Writer } from '../binary-read'
import { Vec2 } from '../../vector2'
import { readPoint, writePoint } from './utils'

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
        Object.assign(this, data)
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
        })
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
}
