import { Reader } from '../binary-read';
import { Writer } from '../binary-write';
import { Vec3 } from '../../vector3';

export enum ObjectType {
    monster = 0,
    object,
    item,
    player,
    goal,
    savedSoundSource
}

export enum ObjectFlags {
    invisible = 0x0001,
    platformSound = 0x001,
    hangingFromCeiling = 0x0002,
    blind = 0x0004,
    deaf = 0x0008,
    floating = 0x0010,
    networkOnly = 0x0020,
}

interface MapObjectConstructor {
    type: ObjectType;
    index: number;
    facing: number; // is sound volume for savedSoundSource
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
        this.type = data.type;
        this.index = data.index;
        this.facing = data.facing;
        this.polygon = data.polygon;
        this.position = data.position;
        this.flags = data.flags;
    }

    static read(reader: Reader): MapObject {
        return new MapObject({
            type: reader.uint16(),
            index: reader.uint16(),
            facing: reader.uint16(),
            polygon: reader.uint16(),
            position: [reader.int16(), reader.int16(), reader.int16()],
            flags: reader.uint16(),
        });
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

