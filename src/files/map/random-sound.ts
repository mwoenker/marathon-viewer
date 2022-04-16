import { Reader } from '../binary-read';
import { Writer } from '../binary-write';

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
        this.flags = data.flags;
        this.soundIndex = data.soundIndex;
        this.volume = data.volume;
        this.deltaVolume = data.deltaVolume;
        this.period = data.period;
        this.deltaPeriod = data.deltaPeriod;
        this.direction = data.direction;
        this.deltaDirection = data.deltaDirection;
        this.pitch = data.pitch;
        this.deltaPitch = data.deltaPitch;
        this.phase = data.phase;
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

        writer.zeros(6);
    }
}
