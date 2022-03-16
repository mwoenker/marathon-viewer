import { Reader, Writer } from '../binary-read';

interface LineConstructor {
    begin: number;
    end: number;
    flags: number;
    length: number;
    highestFloor: number;
    highestCeiling: number;
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
    highestCeiling: number;
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
        this.highestCeiling = data.highestCeiling;
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
            highestCeiling: reader.int16(),
            frontSide: reader.int16(),
            backSide: reader.int16(),
            frontPoly: reader.int16(),
            backPoly: reader.int16()
        });
        reader.skip(12)
        return line;
    }

    write(writer: Writer): void {
        writer.uint16(this.begin);
        writer.uint16(this.end);
        writer.uint16(this.flags);
        writer.uint16(this.highestFloor);
        writer.uint16(this.highestCeiling);
        writer.uint16(this.frontSide);
        writer.uint16(this.backSide);
        writer.uint16(this.frontPoly);
        writer.uint16(this.backPoly);
        writer.zeros(12);
    }
}

