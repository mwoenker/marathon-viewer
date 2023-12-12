import { TransferMode } from '../wad';
import { readPoint, writePoint } from './utils';
import { Vec2 } from '../../vector2';
import { Reader } from '../binary-read';
import { Writer } from '../binary-write';

export interface SideTexConstructor {
    offset?: Vec2,
    texture?: number
}

export class SideTex {
    offset: Vec2;
    texture: number;

    constructor(data: SideTexConstructor = {}) {
        this.offset = data.offset ?? [0, 0];
        this.texture = data.texture ?? 0xffff;
    }

    static read(reader: Reader): SideTex {
        return new SideTex({
            offset: readPoint(reader),
            texture: reader.uint16(), // shape descriptor
        });
    }

    write(writer: Writer): void {
        writePoint(writer, this.offset);
        writer.uint16(this.texture);
    }
}

export interface SideConstructor {
    type: number;
    flags?: number;
    primaryTexture?: SideTex;
    secondaryTexture?: SideTex;
    transparentTexture?: SideTex;
    collisionTopLeft?: Vec2;
    collisionTopRight?: Vec2;
    collisionBottomLeft?: Vec2;
    collisionBottomRight?: Vec2;
    controlPanelType?: number;
    controlPanelPermutation?: number;
    primaryTransferMode?: number;
    secondaryTransferMode?: number;
    transparentTransferMode?: number;
    polygonIndex: number;
    lineIndex: number;
    primaryLightsourceIndex?: number;
    secondaryLightsourceIndex?: number;
    transparentLightsourceIndex?: number;
    ambientDelta?: number;
}

export class Side {
    readonly type: number;
    readonly flags: number;
    readonly primaryTexture: SideTex;
    readonly secondaryTexture: SideTex;
    readonly transparentTexture: SideTex;
    readonly collisionTopLeft: Vec2;
    readonly collisionTopRight: Vec2;
    readonly collisionBottomLeft: Vec2;
    readonly collisionBottomRight: Vec2;
    readonly controlPanelType: number;
    readonly controlPanelPermutation: number;
    readonly primaryTransferMode: number;
    readonly secondaryTransferMode: number;
    readonly transparentTransferMode: number;
    readonly polygonIndex: number;
    readonly lineIndex: number;
    readonly primaryLightsourceIndex: number;
    readonly secondaryLightsourceIndex: number;
    readonly transparentLightsourceIndex: number;
    readonly ambientDelta: number;

    constructor(data: SideConstructor) {
        if (!Number.isInteger(data.type) ||
            !Number.isInteger(data.polygonIndex) ||
            !Number.isInteger(data.lineIndex)
        ) {
            throw new Error('Invalid arguments to side constructor');
        }

        this.type = data.type;
        this.flags = data.flags ?? 0;
        this.primaryTexture = data.primaryTexture ?? new SideTex();
        this.secondaryTexture = data.secondaryTexture ?? new SideTex();
        this.transparentTexture = data.transparentTexture ?? new SideTex();
        this.collisionTopLeft = data.collisionTopLeft ?? [0, 0];
        this.collisionTopRight = data.collisionTopRight ?? [0, 0];
        this.collisionBottomLeft = data.collisionBottomLeft ?? [0, 0];
        this.collisionBottomRight = data.collisionBottomRight ?? [0, 0];
        this.controlPanelType = data.controlPanelType ?? 0;
        this.controlPanelPermutation = data.controlPanelPermutation ?? 0;
        this.primaryTransferMode = data.primaryTransferMode ?? TransferMode.normal;
        this.secondaryTransferMode = data.secondaryTransferMode ?? TransferMode.normal;
        this.transparentTransferMode = data.transparentTransferMode ?? TransferMode.normal;
        this.polygonIndex = data.polygonIndex;
        this.lineIndex = data.lineIndex;
        this.primaryLightsourceIndex = data.primaryLightsourceIndex ?? 0;
        this.secondaryLightsourceIndex = data.secondaryLightsourceIndex ?? 0;
        this.transparentLightsourceIndex = data.transparentLightsourceIndex ?? 0;
        this.ambientDelta = data.ambientDelta ?? 0;
    }

    patch(update: Partial<SideConstructor>): Side {
        return new Side({ ...this, ...update });
    }

    static read(reader: Reader): Side {
        const sideTex = () => new SideTex({
            offset: readPoint(reader),
            texture: reader.uint16(), // shape descriptor
        });
        const line = new Side({
            type: reader.uint16(),
            flags: reader.uint16(),
            primaryTexture: sideTex(),
            secondaryTexture: sideTex(),
            transparentTexture: sideTex(),
            collisionTopLeft: readPoint(reader),
            collisionTopRight: readPoint(reader),
            collisionBottomLeft: readPoint(reader),
            collisionBottomRight: readPoint(reader),
            controlPanelType: reader.int16(),
            controlPanelPermutation: reader.int16(),
            primaryTransferMode: reader.int16(),
            secondaryTransferMode: reader.int16(),
            transparentTransferMode: reader.int16(),
            polygonIndex: reader.int16(),
            lineIndex: reader.int16(),
            primaryLightsourceIndex: reader.int16(),
            secondaryLightsourceIndex: reader.int16(),
            transparentLightsourceIndex: reader.int16(),
            ambientDelta: reader.int32(),
        });
        reader.skip(2);
        return line;
    }

    write(writer: Writer): void {
        writer.uint16(this.type);
        writer.uint16(this.flags);
        this.primaryTexture.write(writer);
        this.secondaryTexture.write(writer);
        this.transparentTexture.write(writer);
        writePoint(writer, this.collisionTopLeft);
        writePoint(writer, this.collisionTopRight);
        writePoint(writer, this.collisionBottomLeft);
        writePoint(writer, this.collisionBottomRight);
        writer.int16(this.controlPanelType);
        writer.int16(this.controlPanelPermutation);
        writer.int16(this.primaryTransferMode);
        writer.int16(this.secondaryTransferMode);
        writer.int16(this.transparentTransferMode);
        writer.int16(this.polygonIndex);
        writer.int16(this.lineIndex);
        writer.int16(this.primaryLightsourceIndex);
        writer.int16(this.secondaryLightsourceIndex);
        writer.int16(this.transparentLightsourceIndex);
        writer.int32(this.ambientDelta);
        writer.zeros(2);
    }
}

