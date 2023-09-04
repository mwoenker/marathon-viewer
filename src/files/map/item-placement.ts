import { Reader } from '../binary-read';
import { Writer } from '../binary-write';

interface ItemPlacementConstructor {
    flags?: number;
    initialCount?: number;
    minimumCount?: number;
    maximumCount?: number;
    randomCount?: number;
    randomChance?: number;
}

export class ItemPlacement {
    readonly flags: number;
    readonly initialCount: number;
    readonly minimumCount: number;
    readonly maximumCount: number;
    readonly randomCount: number;
    readonly randomChance: number;

    constructor(data: ItemPlacementConstructor = {}) {
        this.flags = data.flags ?? 0;
        this.initialCount = data.initialCount ?? 0;
        this.minimumCount = data.minimumCount ?? 0;
        this.maximumCount = data.maximumCount ?? 0;
        this.randomCount = data.randomCount ?? 0;
        this.randomChance = data.randomChance ?? 0;
    }

    static read(reader: Reader): ItemPlacement {
        return new ItemPlacement({
            flags: reader.uint16(),
            initialCount: reader.int16(),
            minimumCount: reader.int16(),
            maximumCount: reader.int16(),
            randomCount: reader.int16(),
            randomChance: reader.uint16(),
        });
    }

    write(writer: Writer): void {
        writer.uint16(this.flags);
        writer.int16(this.initialCount);
        writer.int16(this.minimumCount);
        writer.int16(this.maximumCount);
        writer.int16(this.randomCount);
        writer.uint16(this.randomChance);
    }
}
