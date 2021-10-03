import { Reader, Writer } from '../binary-read'

interface RandomSoundConstructor {
    flags: number;
    soundIndex: number;
    volume: number;
    deltaVolume: number;
    period: number;
    deltaPeriod: number;
    direction: number;
    deltaDirection: number;
    pitch: number;
    deltaPitch: number;
    phase: number;
}

export class RandomSound {
    flags: number;
    soundIndex: number;
    volume: number;
    deltaVolume: number;
    period: number;
    deltaPeriod: number;
    direction: number;
    deltaDirection: number;
    pitch: number;
    deltaPitch: number;
    phase: number;

    constructor(data: RandomSoundConstructor) {
        Object.assign(this, data)
    }

    static read(reader: Reader): RandomSound {
        const randomSound = new RandomSound({
            flags: reader.uint16(),
            soundIndex: reader.int16(),
            volume: reader.int16(),
            deltaVolume: reader.int16(),
            period: reader.int16(),
            deltaPeriod: reader.int16(),
            direction: reader.int16(),
            deltaDirection: reader.int16(),
            pitch: reader.int32(), // fixed point
            deltaPitch: reader.int32(), // fixed point
            phase: reader.int16(),
        });
        reader.skip(6);
        return randomSound;
    }

    write(writer: Writer): void {
        writer.uint16(this.flags);
        writer.int16(this.soundIndex);
        writer.int16(this.volume);
        writer.int16(this.deltaVolume);
        writer.int16(this.period);
        writer.int16(this.deltaPeriod);
        writer.int16(this.direction);
        writer.int16(this.deltaDirection);
        writer.int32(this.pitch);
        writer.int32(this.deltaPitch);
        writer.int16(this.phase);

        writer.zeros(6)
    }
}
