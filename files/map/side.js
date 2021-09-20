import {transferMode} from '../wad.js';
import {readPoint, writePoint} from './utils.js';

export class SideTex {
    constructor({offset, texture} = {}) {
        this.offset = offset ?? [0, 0];
        this.texture = texture ?? 0xffff;
    }

    read(reader) {
        return new SideTex({
            offset: readPoint(reader),
            texture: reader.uint16(), // shape descriptor
        });
    }

    write(writer) {
        writePoint(writer, this.offset);
        writer.uint16(this.texture);
    }
}

export class Side {
    constructor({
        type,
        flags,
        primaryTexture,
        secondaryTexture,
        transparentTexture,
        collisionTopLeft,
        collisionTopRight,
        collisionBottomLeft,
        collisionBottomRight,
        controlPanelType,
        controlPanelPermutation,
        primaryTransferMode,
        secondaryTransferMode,
        transparentTransferMode,
        polygonIndex,
        lineIndex,
        primaryLightsourceIndex,
        secondaryLightsourceIndex,
        transparentLightsourceIndex,
        ambientDelta,
    }) {
        if (! Number.isInteger(type) ||
            ! Number.isInteger(polygonIndex) ||
            ! Number.isInteger(lineIndex)
           ) {
            throw new Error('Invalid arguments to side constructor');
        }
        
        this.type = type;
        this.flags = flags ?? 0;
        this.primaryTexture = primaryTexture ?? new SideTex();
        this.secondaryTexture = secondaryTexture ?? new SideTex();
        this.transparentTexture = transparentTexture ?? new SideTex();
        this.collisionTopLeft = collisionTopLeft ?? [0, 0];
        this.collisionTopRight = collisionTopRight ?? [0, 0];
        this.collisionBottomLeft = collisionBottomLeft ?? [0, 0];
        this.collisionBottomRight = collisionBottomRight ?? [0, 0];
        this.controlPanelType = controlPanelType ?? 0;
        this.controlPanelPermutation = controlPanelPermutation ?? 0;
        this.primaryTransferMode = primaryTransferMode ?? transferMode.normal;
        this.secondaryTransferMode = secondaryTransferMode ?? transferMode.normal;
        this.transparentTransferMode = transparentTransferMode ?? transferMode.normal;
        this.polygonIndex = polygonIndex;
        this.lineIndex = lineIndex;
        this.primaryLightsourceIndex = primaryLightsourceIndex ?? 0;
        this.secondaryLightsourceIndex = secondaryLightsourceIndex ?? 0;
        this.transparentLightsourceIndex = transparentLightsourceIndex ?? 0;
        this.ambientDelta = ambientDelta ?? 0;
    }

    static read(reader) {
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

    write(writer) {
        writer.uint16(this.type);
        writer.uint16(this.flags);
        this.primaryTexture.write(writer);
        this.secondaryTexture.write(writer);
        this.transparentTexture.write(writer);
        writePoint(writer, this.collisionTopLeft);
        writePoint(writer, this.collisionTopRight);
        writePoint(writer, this.collisionBottomLeftRight);
        writePoint(writer, this.collisionTopRight);
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
    }
}

