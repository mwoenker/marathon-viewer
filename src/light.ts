import { Light, LightFunctionType, LightStateType } from './files/map/light';
import { lerp } from './utils';

function randInt(upperBound: number) {
    return Math.floor(upperBound * Math.random());
}

function sineInterp(fraction: number, a: number, b: number) {
    const radians = fraction * Math.PI;
    const t = (1 - Math.cos(radians)) / 2;
    return lerp(t, a, b);
}

function flicker(phase: number, period: number, initial: number, final: number) {
    const sine = sineInterp(phase / period, initial, final);
    const d = final - sine;
    const val = sine + randInt(d);
    if (val < 0) {
        console.log({ val, d, sine, phase, period, initial, final });
    }
    return val;
}

function lightTransition(
    functionType: LightFunctionType,
    initial: number,
    final: number,
    phase: number,
    period: number
) {
    switch (functionType) {
        case LightFunctionType.constant:
            return final;
        case LightFunctionType.linear:
            return lerp(phase / period, initial, final);
        case LightFunctionType.smooth:
            return sineInterp(phase / period, initial, final);
        case LightFunctionType.flicker:
            return flicker(phase, period, initial, final);
    }
}

function nextState(oldState: LightStateType, isStateless: boolean) {
    switch (oldState) {
        case LightStateType.becomingActive:
            return LightStateType.primaryActive;
        case LightStateType.primaryActive:
            return LightStateType.secondaryActive;
        case LightStateType.secondaryActive:
            if (isStateless) {
                return LightStateType.becomingInactive;
            } else {
                return LightStateType.primaryActive;
            }
        case LightStateType.becomingInactive:
            return LightStateType.primaryInactive;
        case LightStateType.primaryInactive:
            return LightStateType.secondaryInactive;
        case LightStateType.secondaryInactive:
            if (isStateless) {
                return LightStateType.becomingActive;
            } else {
                return LightStateType.primaryInactive;
            }
    }
}

export class LightState {
    phase: number;
    period: number;
    state: LightStateType;
    intensity: number;
    initialIntensity: number;
    finalIntensity: number;
    light: Light;

    constructor(light: Light) {
        this.light = light;
        this.state = light.initiallyActive()
            ? LightStateType.primaryActive
            : LightStateType.primaryInactive;
        const prevState = light.initiallyActive()
            ? LightStateType.secondaryActive
            : LightStateType.secondaryInactive;
        const func = this.light.states[this.state];
        const prevFunc = this.light.states[prevState];
        this.phase = light.phase;
        this.period = func.period + randInt(func.deltaPeriod + 1);
        this.intensity = prevFunc.intensity + randInt(prevFunc.deltaIntensity + 1);
        this.initialIntensity = this.intensity;
        this.finalIntensity = func.intensity + randInt(func.deltaIntensity + 1);
    }

    advanceTicks(nTicks: number): void {
        this.phase += nTicks;
        this.updateState();
        this.intensity = Math.floor(lightTransition(
            this.light.states[this.state].func,
            this.initialIntensity,
            this.finalIntensity,
            this.phase,
            this.period));
    }

    updateState(): void {
        while (this.phase >= this.period) {
            this.phase -= this.period;
            const newState = nextState(this.state, this.light.isStateless());
            const func = this.light.states[newState];
            this.period = func.period + randInt(func.deltaPeriod + 1);
            this.initialIntensity = this.intensity;
            this.finalIntensity = func.intensity + randInt(func.deltaIntensity + 1);
            this.state = newState;
        }
    }
}
