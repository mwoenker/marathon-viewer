import { Reader } from '../binary-read';
import { Writer } from '../binary-write';

export enum LineFlag {
    decorative = 0x100,
    hasTransparentSide = 0x200,
    variableElevation = 0x400,
    elevation = 0x800,
    landscape = 0x1000,
    transparent = 0x2000,
    solid = 0x4000
}

interface LineConstructor {
    begin: number;
    end: number;
    flags: number;
    length: number;
    highestFloor: number;
    lowestCeiling: number;
    frontSide: number;
    backSide: number;
    frontPoly: number;
    backPoly: number;
}

export class Line implements LineConstructor {
    begin: number;
    end: number;
    flags: number;
    length: number;
    highestFloor: number;
    lowestCeiling: number;
    frontSide: number;
    backSide: number;
    frontPoly: number;
    backPoly: number;

    constructor(data: LineConstructor) {
        this.begin = data.begin;
        this.end = data.end;
        this.flags = data.flags;
        this.length = data.length;
        this.highestFloor = data.highestFloor;
        this.lowestCeiling = data.lowestCeiling;
        this.frontSide = data.frontSide;
        this.backSide = data.backSide;
        this.frontPoly = data.frontPoly;
        this.backPoly = data.backPoly;
    }

    static read(reader: Reader): Line {
        const line = new Line({
            begin: reader.int16(),
            end: reader.int16(),
            flags: reader.uint16(),
            length: reader.uint16(),
            highestFloor: reader.int16(),
            lowestCeiling: reader.int16(),
            frontSide: reader.int16(),
            backSide: reader.int16(),
            frontPoly: reader.int16(),
            backPoly: reader.int16()
        });
        reader.skip(12);
        return line;
    }

    write(writer: Writer): void {
        writer.int16(this.begin);
        writer.int16(this.end);
        writer.uint16(this.flags);
        writer.uint16(this.length);
        writer.int16(this.highestFloor);
        writer.int16(this.lowestCeiling);
        writer.int16(this.frontSide);
        writer.int16(this.backSide);
        writer.int16(this.frontPoly);
        writer.int16(this.backPoly);
        writer.zeros(12);
    }

    hasFlag(flag: LineFlag): boolean {
        return (this.flags & flag) !== 0;
    }

    setFlag(flag: LineFlag, val: boolean): void {
        this.flags = (this.flags & ~flag) | (val ? flag : 0);
    }
}

