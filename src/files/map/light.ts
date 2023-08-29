import { Reader } from '../binary-read';
import { Writer } from '../binary-write';

export enum LightFunctionType {
    constant,
    linear,
    smooth,
    flicker
}

export enum LightStateType {
    becomingActive,
    primaryActive,
    secondaryActive,
    becomingInactive,
    primaryInactive,
    secondaryInactive,
}

const nStateTypes = 6;

export interface LightFunction {
    func: LightFunctionType;
    period: number;
    deltaPeriod: number;
    intensity: number;
    deltaIntensity: number;
}

interface LightConstructor {
    type: number;
    flags: number;
    phase: number;
    states: LightFunction[];
    tag: number;
}

export enum LightFlagBits {
    initiallyActive,
    hasSlavedIntensities, // not used for anything?
    stateless,
}

export class Light {
    type: number;
    flags: number;
    phase: number;
    states: LightFunction[];
    tag: number;

    constructor(data: LightConstructor) {
        this.type = data.type;
        this.flags = data.flags;
        this.phase = data.phase;
        this.states = data.states;
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
        const parseLightFunctions = () => {
            const states = new Array(nStateTypes);
            states[LightStateType.primaryActive] = lightFunction();
            states[LightStateType.secondaryActive] = lightFunction();
            states[LightStateType.becomingActive] = lightFunction();
            states[LightStateType.primaryInactive] = lightFunction();
            states[LightStateType.secondaryInactive] = lightFunction();
            states[LightStateType.becomingInactive] = lightFunction();
            return states;
        };

        const light = {
            type: reader.int16(),
            flags: reader.uint16(),
            phase: reader.int16(),
            states: parseLightFunctions(),
            tag: reader.int16(),
        };
        reader.skip(8);
        return new Light(light);

    }

    write(writer: Writer): void {
        const writeLightFunction = (lightFunction: LightFunction): void => {
            writer.int16(lightFunction.func);
            writer.int16(lightFunction.period);
            writer.int16(lightFunction.deltaPeriod);
            writer.int32(lightFunction.intensity);
            writer.int32(lightFunction.deltaIntensity);
        };
        writer.int16(this.type);
        writer.int16(this.flags);
        writer.int16(this.phase);

        writeLightFunction(this.states[LightStateType.primaryActive]);
        writeLightFunction(this.states[LightStateType.secondaryActive]);
        writeLightFunction(this.states[LightStateType.becomingActive]);
        writeLightFunction(this.states[LightStateType.primaryInactive]);
        writeLightFunction(this.states[LightStateType.secondaryInactive]);
        writeLightFunction(this.states[LightStateType.becomingInactive]);

        writer.int16(this.tag);
        writer.zeros(8);
    }

    testFlag(flag: LightFlagBits): boolean {
        return (this.flags & (1 << flag)) !== 0;
    }

    isStateless(): boolean {
        //return this.testFlag(LightFlagBits.stateless);
        // lol bungie broke this
        return false;
    }

    initiallyActive(): boolean {
        return this.testFlag(LightFlagBits.initiallyActive);
    }
}
