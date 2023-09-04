import { Reader } from '../binary-read';
import { Writer } from '../binary-write';

export interface PlatformConstructor {
    type: number;
    speed: number;
    delay: number;
    maximumHeight: number;
    minimumHeight: number;
    staticFlags: number;
    polygonIndex: number;
    tag: number;
}

export enum PlatformFlagBit {
    initiallyActive,
    initiallyExtended,
    deactivatesAtEachLevel,
    deactivatesAtInitialLevel,
    activatesAdjacentPlatformsWhenDeactivating,
    extendsFloorToCeiling,
    comesFromFloor,
    comesFromCeiling,
    causesDamage,
    doesNotActivateParent,
    activatesOnlyOnce,
    activatesLight,
    deactivatesLight,
    playerControllable,
    monsterControllable,
    reversesDirectionWhenObstructed,
    cannotBeExternallyDeactivated,
    usesNativePolygonHeights,
    delaysBeforeActivation,
    activatesAdjacentPlatformsWhenActivating,
    deactivatesAdjacentPlatformsWhenActivating,
    deactivatesAdjacentPlatformsWhenDeactivating,
    contractsSlower,
    activatesAdjacentPlatformsAtEachLevel,
    locked,
    secret,
    door,
    floodsM1,
}

export class Platform {
    readonly type: number;
    readonly speed: number;
    readonly delay: number;
    readonly maximumHeight: number;
    readonly minimumHeight: number;
    readonly staticFlags: number;
    readonly polygonIndex: number;
    readonly tag: number;

    constructor(data: PlatformConstructor) {
        this.type = data.type;
        this.speed = data.speed;
        this.delay = data.delay;
        this.minimumHeight = data.minimumHeight;
        this.maximumHeight = data.maximumHeight;
        this.staticFlags = data.staticFlags;
        this.polygonIndex = data.polygonIndex;
        this.tag = data.tag;
    }

    static read(reader: Reader): Platform {
        const platform = new Platform({
            type: reader.int16(),
            speed: reader.int16(),
            delay: reader.int16(),
            maximumHeight: reader.int16(),
            minimumHeight: reader.int16(),
            staticFlags: reader.uint32(),
            polygonIndex: reader.int16(),
            tag: reader.int16(),
        });

        reader.skip(14);
        return platform;
    }

    write(writer: Writer): void {
        writer.int16(this.type);
        writer.int16(this.speed);
        writer.int16(this.delay);
        writer.int16(this.maximumHeight);
        writer.int16(this.minimumHeight);
        writer.uint32(this.staticFlags);
        writer.int16(this.polygonIndex);
        writer.int16(this.tag);
        writer.zeros(14);
    }

    comesFromCeiling(): boolean {
        return this.hasFlag(PlatformFlagBit.comesFromCeiling);
    }

    comesFromFloor(): boolean {
        return this.hasFlag(PlatformFlagBit.comesFromFloor);
    }

    hasFlag(flagBit: PlatformFlagBit): boolean {
        return (this.staticFlags & (1 << flagBit)) !== 0;
    }
}
