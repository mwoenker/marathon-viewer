import { Reader, Writer } from '../binary-read'
import { Vec3 } from '../../vector3';

export enum ObjectType {
    monster = 0,
    oject,
    item,
    player,
    goal,
    savedSoundSource
}

interface MapObjectConstructor {
    type: ObjectType;
    index: number;
    facing: number;
    polygon: number;
    position: Vec3;
    flags: number;
}

export class MapObject {
    type: ObjectType;
    index: number;
    facing: number;
    polygon: number;
    position: Vec3;
    flags: number;

    constructor(data: MapObjectConstructor) {
        Object.assign(this, data)
    }

    static read(reader: Reader): MapObject {
        return new MapObject({
            type: reader.uint16(),
            index: reader.uint16(),
            facing: reader.uint16(),
            polygon: reader.uint16(),
            position: [reader.int16(), reader.int16(), reader.int16()],
            flags: reader.uint16(),
        })
    }

    write(writer: Writer): void {
        writer.uint16(this.type);
        writer.uint16(this.index);
        writer.uint16(this.facing);
        writer.uint16(this.polygon);
        for (let i = 0; i < 3; ++i) {
            writer.int16(this.position[i]);
        }
        writer.uint16(this.flags);
    }
}

