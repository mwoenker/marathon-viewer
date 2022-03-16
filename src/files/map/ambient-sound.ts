import { Reader, Writer } from '../binary-read'

interface AmbientSoundConstructor {
    flags: number;
    soundIndex: number;
    volume: number;
}

export class AmbientSound {
    flags: number;
    soundIndex: number;
    volume: number;

    constructor(data: AmbientSoundConstructor) {
        this.flags = data.flags;
        this.soundIndex = data.soundIndex;
        this.volume = data.volume;
    }

    static read(reader: Reader): AmbientSound {
        const sound = new AmbientSound({
            flags: reader.uint16(),
            soundIndex: reader.int16(),
            volume: reader.int16(),
        });
        reader.skip(10);
        return sound;
    }

    write(writer: Writer): void {
        writer.uint16(this.flags);
        writer.int16(this.soundIndex);
        writer.int16(this.volume);
        writer.zeros(10)
    }
}
