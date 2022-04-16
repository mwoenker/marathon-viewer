import { MacRomanEncoder } from "./mac-roman-decoder";

const chunkSize = 16 * 1024;

function makeChunk() {
    return new Uint8Array(chunkSize);
}

class ByteBuffer {
    private chunks: Uint8Array[] = [makeChunk()]
    private pos = 0;
    private currentChunk = 0
    private chunkPos = 0

    writeByte(b: number): void {
        if (this.chunkPos >= this.chunks[this.currentChunk].length) {
            ++this.currentChunk;
            this.chunkPos = 0;
            this.chunks.push(makeChunk());
        }
        ++this.pos;
        this.chunks[this.currentChunk][this.chunkPos++] = b;
    }

    size(): number {
        return this.pos;
    }

    concat(): ArrayBuffer {
        const combined = new Uint8Array(this.size());
        let dest = 0;
        this.chunks.forEach((chunk) => {
            for (let src = 0; src < chunk.length && dest <= this.pos; ++src) {
                combined[dest++] = chunk[src];
            }
        });
        return combined.buffer;
    }

    position(): number {
        return this.pos;
    }
}

export class ArrayBufferWriter implements Writer {
    buffer = new ByteBuffer()
    encoder = new MacRomanEncoder()

    uint8(val: number): void {
        this.buffer.writeByte(val);
    }

    uint16(val: number): void {
        this.buffer.writeByte(0xff & (val >> 8));
        this.buffer.writeByte(0xff & val);
    }

    uint32(val: number): void {
        this.buffer.writeByte(0xff & (val >> 24));
        this.buffer.writeByte(0xff & (val >> 16));
        this.buffer.writeByte(0xff & (val >> 8));
        this.buffer.writeByte(0xff & val);
    }

    int8(val: number): void {
        this.uint8(val);
    }

    int16(val: number): void {
        this.uint16(val);
    }

    int32(val: number): void {
        this.uint32(val);
    }

    fixString(length: number, s: string): void {
        const encoded = new Uint8Array(this.encoder.encode(s));
        for (let i = 0; i < length; ++i) {
            if (i < encoded.length) {
                this.buffer.writeByte(encoded[i]);
            } else {
                this.buffer.writeByte(0);
            }
        }
    }

    cString(maxlen: number, s: string): void {
        const encoded = new Uint8Array(this.encoder.encode(s));
        for (let i = 0; i < maxlen; ++i) {
            if (i < encoded.length && i < maxlen - 1) {
                this.buffer.writeByte(encoded[i]);
            } else {
                this.buffer.writeByte(0);
            }
        }
    }

    pascalString(nBytes: number, s: string): void {
        const encoded = new Uint8Array(this.encoder.encode(s));
        if (nBytes < 0 || nBytes > 255) {
            throw new Error('Invalid size for pascal string');
        }
        if (encoded.length > nBytes) {
            throw new Error('Pascal string too large');
        }
        this.buffer.writeByte(encoded.length);
        for (let i = 0; i < nBytes - 1; ++i) {
            if (i < encoded.length) {
                this.buffer.writeByte(encoded[i]);
            } else {
                this.buffer.writeByte(0);
            }
        }
    }

    zeros(nBytes: number): void {
        for (let i = 0; i < nBytes; ++i) {
            this.buffer.writeByte(0);
        }
    }

    bytes(data: ArrayBuffer): void {
        const bytes = new Uint8Array(data);
        for (let i = 0; i < bytes.length; ++i) {
            this.buffer.writeByte(bytes[i]);
        }
    }

    getBuffer(): ArrayBuffer {
        return this.buffer.concat();
    }

    position(): number {
        return this.buffer.position();
    }
}

export interface Writer {
    uint8(val: number): void;
    uint16(val: number): void;
    uint32(val: number): void;
    int8(val: number): void;
    int16(val: number): void;
    int32(val: number): void;
    fixString(length: number, s: string): void;
    cString(maxlen: number, s: string): void;
    pascalString(nBytes: number, s: string): void;
    bytes(buf: ArrayBuffer): void
    zeros(nBytes: number): void
    position(): number
}

