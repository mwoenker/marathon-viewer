import { Reader, Writer } from '../binary-read'

interface LightFunction {
    func: number;
    period: number;
    deltaPeriod: number;
    intensity: number;
    deltaIntensity: number;
}

interface LightConstructor {
    type: number;
    flags: number;
    phase: number;
    primaryActive: LightFunction;
    secondaryActive: LightFunction;
    becomingActive: LightFunction;
    primaryInactive: LightFunction;
    secondaryInactive: LightFunction;
    becomingInactive: LightFunction;
    tag: number;
}

export class Light {
    type: number;
    flags: number;
    phase: number;
    primaryActive: LightFunction;
    secondaryActive: LightFunction;
    becomingActive: LightFunction;
    primaryInactive: LightFunction;
    secondaryInactive: LightFunction;
    becomingInactive: LightFunction;
    tag: number;

    constructor(data: LightConstructor) {
        this.type = data.type;
        this.flags = data.flags;
        this.phase = data.phase;
        this.primaryActive = data.primaryActive;
        this.secondaryActive = data.secondaryActive;
        this.becomingActive = data.becomingActive;
        this.primaryInactive = data.primaryInactive;
        this.secondaryInactive = data.secondaryInactive;
        this.becomingInactive = data.becomingInactive;
        this.tag = data.tag;
    }

    static read(reader: Reader): Light {
        const lightFunction = () => ({
            func: reader.int16(),
            period: reader.int16(),
            deltaPeriod: reader.int16(),
            intensity: reader.int32(),
            deltaIntensity: reader.int32(),
        });
        const light = {
            type: reader.int16(),
            flags: reader.uint16(),
            phase: reader.int16(),
            primaryActive: lightFunction(),
            secondaryActive: lightFunction(),
            becomingActive: lightFunction(),
            primaryInactive: lightFunction(),
            secondaryInactive: lightFunction(),
            becomingInactive: lightFunction(),
            tag: reader.int16(),
        };
        reader.skip(8);
        return new Light(light)

    }

    writer(writer: Writer): void {
        const writeLightFunction = (lightFunction: LightFunction): void => {
            writer.int16(lightFunction.func);
            writer.int16(lightFunction.period);
            writer.int16(lightFunction.deltaPeriod);
            writer.int32(lightFunction.intensity);
            writer.int32(lightFunction.deltaIntensity);
        }
        writer.int16(this.type);
        writer.int16(this.flags);
        writer.int16(this.phase);
        writeLightFunction(this.primaryActive);
        writeLightFunction(this.secondaryActive);
        writeLightFunction(this.becomingActive);
        writeLightFunction(this.primaryInactive);
        writeLightFunction(this.secondaryInactive);
        writeLightFunction(this.becomingInactive);
        writer.int16(this.tag);
        writer.zeros(8);
    }
}
