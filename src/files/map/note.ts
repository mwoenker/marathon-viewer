import { Reader, Writer } from '../binary-read';
import { readPoint, writePoint } from './utils';
import { Vec2 } from '../../vector2';

interface NoteConstructor {
    type: number;
    location: Vec2;
    polygonIndex: number;
    text: string
}

export class Note {
    type: number;
    location: Vec2;
    polygonIndex: number;
    text: string

    constructor(data: NoteConstructor) {
        this.type = data.type;
        this.location = data.location;
        this.polygonIndex = data.polygonIndex;
        this.text = data.text;
    }

    static read(reader: Reader): Note {
        const note = new Note({
            type: reader.int16(),
            location: readPoint(reader), // lower left of text
            polygonIndex: reader.int16(),
            text: reader.cString(64),
        });
        return note;
    }

    write(writer: Writer): void {
        writer.int16(this.type);
        writePoint(writer, this.location);
        writer.int16(this.polygonIndex);
        writer.cString(64, this.text);
    }
}
