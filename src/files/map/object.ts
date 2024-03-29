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
    type?: ObjectType;
    index?: number;
    facing?: number; // is sound volume for savedSoundSource
    polygon: number;
    position?: Vec3;
    flags?: number;
}

export class MapObject {
    readonly type: ObjectType;
    readonly index: number;
    readonly facing: number;
    readonly polygon: number;
    readonly position: Vec3;
    readonly flags: number;

    constructor(data: MapObjectConstructor) {
        this.type = data.type ?? ObjectType.monster;
        this.index = data.index ?? 0;
        this.facing = data.facing ?? 0;
        this.polygon = data.polygon ?? -1;
        this.position = data.position ?? [0, 0, 0];
        this.flags = data.flags ?? 0;
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

