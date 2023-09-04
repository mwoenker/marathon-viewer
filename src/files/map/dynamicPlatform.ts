import { Reader } from '../binary-read';
import { Writer } from '../binary-write';
import { Platform, PlatformFlagBit } from './platform';
import { readList } from './utils';

interface EndpointOwner {
    firstPolygonIndex: number;
    polygonIndexCount: number;
    firstLineIndex: number;
    lineIndexCount: number;
}

interface DynamicPlatformConstructor {
    type: number;
    staticFlags: number;
    speed: number;
    delay: number;
    minFloorHeight: number;
    maxFloorHeight: number;
    minCeilingHeight: number;
    maxCeilingHeight: number;
    polygonIndex: number;
    dynamicFlags: number;
    floorHeight: number;
    ceilingHeight: number;
    ticksUntilRestart: number;
    endpointOwners: EndpointOwner[];
    parentPlatformIndex: number;
    tag: number;
}

export class DynamicPlatform {
    readonly type: number;
    readonly staticFlags: number;
    readonly speed: number;
    readonly delay: number;
    readonly minFloorHeight: number;
    readonly maxFloorHeight: number;
    readonly minCeilingHeight: number;
    readonly maxCeilingHeight: number;
    readonly polygonIndex: number;
    readonly dynamicFlags: number;
    readonly floorHeight: number;
    readonly ceilingHeight: number;
    readonly ticksUntilRestart: number;
    readonly endpointOwners: EndpointOwner[];
    readonly parentPlatformIndex: number;
    readonly tag: number;

    constructor(data: DynamicPlatformConstructor) {
        this.type = data.type;
        this.staticFlags = data.staticFlags;
        this.speed = data.speed;
        this.delay = data.delay;
        this.minFloorHeight = data.minFloorHeight;
        this.maxFloorHeight = data.maxFloorHeight;
        this.minCeilingHeight = data.minCeilingHeight;
        this.maxCeilingHeight = data.maxCeilingHeight;
        this.polygonIndex = data.polygonIndex;
        this.dynamicFlags = data.dynamicFlags;
        this.floorHeight = data.floorHeight;
        this.ceilingHeight = data.ceilingHeight;
        this.ticksUntilRestart = data.ticksUntilRestart;
        this.endpointOwners = data.endpointOwners;
        this.parentPlatformIndex = data.parentPlatformIndex;
        this.tag = data.tag;
    }

    static read(reader: Reader): DynamicPlatform {
        const endpointOwner = () => ({
            firstPolygonIndex: reader.int16(),
            polygonIndexCount: reader.int16(),
            firstLineIndex: reader.int16(),
            lineIndexCount: reader.int16(),
        });

        const platform = new DynamicPlatform({
            type: reader.int16(),
            staticFlags: reader.uint32(),
            speed: reader.int16(),
            delay: reader.int16(),
            minFloorHeight: reader.int16(),
            maxFloorHeight: reader.int16(),
            minCeilingHeight: reader.int16(),
            maxCeilingHeight: reader.int16(),
            polygonIndex: reader.int16(),
            dynamicFlags: reader.uint16(),
            floorHeight: reader.int16(),
            ceilingHeight: reader.int16(),
            ticksUntilRestart: reader.int16(),
            endpointOwners: readList(8, endpointOwner),
            parentPlatformIndex: reader.int16(),
            tag: reader.int16(),
        });

        reader.skip(44);
        return platform;
    }

    write(writer: Writer): void {
        writer.int16(this.type);
        writer.uint32(this.staticFlags);
        writer.int16(this.speed);
        writer.int16(this.delay);
        writer.int16(this.minFloorHeight);
        writer.int16(this.maxFloorHeight);
        writer.int16(this.minCeilingHeight);
        writer.int16(this.maxCeilingHeight);
        writer.int16(this.polygonIndex);
        writer.uint16(this.dynamicFlags);
        writer.int16(this.floorHeight);
        writer.int16(this.ceilingHeight);
        writer.int16(this.ticksUntilRestart);

        this.endpointOwners.forEach((owner: EndpointOwner) => {
            writer.int16(owner.firstPolygonIndex);
            writer.int16(owner.polygonIndexCount);
            writer.int16(owner.firstLineIndex);
            writer.int16(owner.lineIndexCount);
        });

        writer.int16(this.parentPlatformIndex);
        writer.int16(this.tag);

        writer.zeros(44);
    }

    hasFlag(flagBit: PlatformFlagBit): boolean {
        return (this.staticFlags & (1 << flagBit)) !== 0;
    }

    comesFromCeiling(): boolean {
        return this.hasFlag(PlatformFlagBit.comesFromCeiling);
    }

    comesFromFloor(): boolean {
        return this.hasFlag(PlatformFlagBit.comesFromFloor);
    }

    // convert to non-preprocessed form
    toStatic(): Platform {
        let minimumHeight;
        let maximumHeight;

        if (this.comesFromCeiling() && this.comesFromFloor()) {
            minimumHeight = this.minFloorHeight;
            maximumHeight = this.maxCeilingHeight;
        } else if (this.comesFromCeiling()) {
            minimumHeight = this.minCeilingHeight;
            maximumHeight = this.maxCeilingHeight;
        } else if (this.comesFromFloor()) {
            minimumHeight = this.minFloorHeight;
            maximumHeight = this.maxFloorHeight;
        } else {
            console.warn('Platform not coming from floor, ceiling or both');
            minimumHeight = 0;
            maximumHeight = 0;
        }

        return new Platform({
            type: this.type,
            speed: this.speed,
            delay: this.delay,
            maximumHeight,
            minimumHeight,
            staticFlags: this.staticFlags,
            polygonIndex: this.polygonIndex,
            tag: this.tag,
        });
    }
}
