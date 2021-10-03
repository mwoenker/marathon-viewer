import { Reader, Writer } from '../binary-read'

interface ItemPlacementConstructor {
    flags: number;
    initialCount: number;
    minimumCount: number;
    maximumCount: number;
    randomCount: number;
    randomChance: number;
}

export class ItemPlacement {
    flags: number;
    initialCount: number;
    minimumCount: number;
    maximumCount: number;
    randomCount: number;
    randomChance: number;

    constructor(data: ItemPlacementConstructor) {
        Object.assign(this, data);
    }

    static read(reader: Reader): ItemPlacement {
        return new ItemPlacement({
            flags: reader.uint16(),
            initialCount: reader.int16(),
            minimumCount: reader.int16(),
            maximumCount: reader.int16(),
            randomCount: reader.int16(),
            randomChance: reader.uint16(),
        })
    }

    write(writer: Writer): void {
        writer.uint16(this.flags);
        writer.uint16(this.initialCount);
        writer.uint16(this.minimumCount);
        writer.uint16(this.maximumCount);
        writer.uint16(this.randomCount);
        writer.uint16(this.randomChance);
    }
}
