import { Reader } from '../binary-read';
import { Writer } from '../binary-write';
import { Vec2 } from '../../vector2';
import { readPoint, writePoint } from './utils';

interface EndpointConstructor {
    flags: number;
    highestFloor: number;
    lowestCeiling: number;
    position: Vec2;
    transformed: Vec2;
    supportingPolyIdx: number;
}

export class Endpoint {
    flags: number;
    highestFloor: number;
    lowestCeiling: number;
    position: Vec2;
    transformed: Vec2;
    supportingPolyIdx: number;

    constructor(data: EndpointConstructor) {
        this.flags = data.flags;
        this.highestFloor = data.highestFloor;
        this.lowestCeiling = data.lowestCeiling;
        this.position = data.position;
        this.transformed = data.transformed;
        this.supportingPolyIdx = data.supportingPolyIdx;
    }

    static read(reader: Reader): Endpoint {
        return new Endpoint({
            flags: reader.uint16(),
            highestFloor: reader.int16(),
            lowestCeiling: reader.int16(),
            position: readPoint(reader),
            transformed: readPoint(reader),
            supportingPolyIdx: reader.int16(),
        });

    }

    write(writer: Writer): void {
        writer.uint16(this.flags);
        writer.int16(this.highestFloor);
        writer.int16(this.lowestCeiling);
        writePoint(writer, this.position);
        writePoint(writer, this.transformed);
        writer.int16(this.supportingPolyIdx);
    }
}
