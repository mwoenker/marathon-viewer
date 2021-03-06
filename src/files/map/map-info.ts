import { Reader } from '../binary-read';
import { Writer } from '../binary-write';

interface MapInfoConstructor {
    environmentCode: number;
    physicsModel: number;
    musicId: number;
    missionFlags: number;
    environmentFlags: number;
    name: string;
    entryFlags: number;
}

export class MapInfo {
    environmentCode: number;
    physicsModel: number;
    musicId: number;
    missionFlags: number;
    environmentFlags: number;
    name: string;
    entryFlags: number;

    constructor(data: MapInfoConstructor) {
        this.environmentCode = data.environmentCode;
        this.physicsModel = data.physicsModel;
        this.musicId = data.musicId;
        this.missionFlags = data.missionFlags;
        this.environmentFlags = data.environmentFlags;
        this.name = data.name;
        this.entryFlags = data.entryFlags;
    }

    static read(reader: Reader): MapInfo {
        const environmentCode = reader.uint16();
        const physicsModel = reader.uint16();
        const musicId = reader.uint16();
        const missionFlags = reader.uint16();
        const environmentFlags = reader.uint16();
        reader.skip(8);
        const name = reader.cString(66);
        const entryFlags = reader.uint32();

        return new MapInfo({
            environmentCode,
            physicsModel,
            musicId,
            missionFlags,
            environmentFlags,
            name,
            entryFlags,
        });
    }

    write(writer: Writer): void {
        writer.uint16(this.environmentCode);
        writer.uint16(this.physicsModel);
        writer.uint16(this.musicId);
        writer.uint16(this.missionFlags);
        writer.uint16(this.environmentFlags);
        writer.zeros(8);
        writer.cString(66, this.name);
        writer.uint32(this.entryFlags);
    }
}
