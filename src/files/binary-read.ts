export interface RandomAccess {
    readRange(begin: number, end: number): Promise<ArrayBuffer>
}

export class SliceFile {
    file: RandomAccess;
    begin: number;
    end: number;

    constructor(file: RandomAccess, begin: number, end: number) {
        this.file = file;
        this.begin = begin;
        this.end = end;
    }

    async readRange(begin: number, end: number): Promise<ArrayBuffer> {
        const realBegin = begin + this.begin;
        const realEnd = end + this.begin;
        if (realEnd > this.end) {
            console.log(this.begin, this.end);
            console.log({ begin, end, realBegin, realEnd });
            console.log(realEnd - end);
            throw new Error('out of bounds read');
        }
        return this.file.readRange(realBegin, realEnd);
    }
}

export class HtmlInputFile {
    file: Blob

    constructor(inputFile: Blob) {
        this.file = inputFile;
    }

    async readRange(start: number, stop: number): Promise<ArrayBuffer> {
        const slice = this.file.slice(start, stop);
        const reader = new FileReader();
        return new Promise<ArrayBuffer>((resolve, reject) => {
            reader.onerror = () => reject(new Error("read error"));
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.readAsArrayBuffer(slice);
        });
    }
}

export class HttpFile {
    url: string

    constructor(url: string) {
        this.url = url;
    }

    async readRange(start: number, stop: number): Promise<ArrayBuffer> {
        const result = await fetch(this.url, {
            headers: { 'Range': `bytes=${start}-${stop}` }
        });
        return result.arrayBuffer();
    }
}

export class ArrayBufferFile {
    buffer: ArrayBuffer

    constructor(buffer: ArrayBuffer) {
        this.buffer = buffer;
    }

    async readRange(start: number, stop: number): Promise<ArrayBuffer> {
        return this.buffer.slice(start, stop);
    }
}

export class Reader {
    bytes: Uint8Array;
    pos: number;
    decoder: TextDecoder;

    constructor(arrayBuffer: ArrayBuffer) {
        this.bytes = new Uint8Array(arrayBuffer);
        this.pos = 0;
        this.decoder = new TextDecoder('x-mac-roman');
    }
    spaceRemaining(): number {
        return this.bytes.byteLength - this.pos;
    }
    eof(): boolean {
        return 0 === this.spaceRemaining();
    }
    requireSpace(nBytes: number): void {
        if (this.spaceRemaining() < nBytes) {
            throw new Error("unexpected end");
        }
    }
    uint8(): number {
        this.requireSpace(1);
        return this.bytes[this.pos++];
    }
    uint16(): number {
        this.requireSpace(2);
        return (this.uint8()) << 8 | this.uint8();
    }
    uint32(): number {
        this.requireSpace(4);
        return (this.uint16() * (1 << 16)) + this.uint16();
    }
    int8(): number {
        this.requireSpace(1);
        const u = this.uint8();
        return (u << 24) >> 24; // sign extend
    }
    int16(): number {
        this.requireSpace(2);
        const u = this.uint16();
        return (u << 16) >> 16; // sign extend
    }
    int32(): number {
        this.requireSpace(4);
        return (this.uint16() << 16) | this.uint16();
    }
    raw(length: number): Uint8Array {
        this.requireSpace(length);
        const bytes = this.bytes.slice(this.pos, this.pos + length);
        this.pos += length;
        return bytes;
    }
    fixString(length: number): string {
        return this.decoder.decode(this.raw(length));
    }
    cString(maxlen: number): string {
        let bytes = this.raw(maxlen);
        for (let i = 0; i < bytes.length; ++i) {
            if (0 === bytes[i]) {
                bytes = bytes.slice(0, i);
                break;
            }
        }
        return this.decoder.decode(bytes);
    }
    pascalString(nBytes: number): string {
        const bytes = this.raw(nBytes);
        return this.decoder.decode(bytes.slice(1, 1 + bytes[0]));
    }
    skip(nBytes: number): void {
        this.requireSpace(nBytes);
        this.pos += nBytes;
    }
    seek(pos: number): void {
        if (pos >= this.bytes.byteLength) {
            throw new Error('Seek past end of data');
        }
        this.pos = pos;
    }
}

export async function readRange(file: RandomAccess, start: number, stop: number): Promise<ArrayBuffer> {
    return file.readRange(start, stop);
}

function macbinCrc(bytes: Uint8Array, start: number, end: number): number {
    let crc = 0;
    for (let i = start; i < end; ++i) {
        let data = bytes[i] << 8;
        for (let j = 0; j < 8; ++j) {
            if ((data ^ crc) & 0x8000) {
                crc = 0xffff & ((crc << 1) ^ 0x1021);
            } else {
                crc = 0xffff & (crc << 1);
            }
            data = 0xffff & (data << 1);
        }
    }
    return crc;
}

export async function getDataFork(file: RandomAccess): Promise<RandomAccess> {
    const macbinChunk = new Uint8Array(await readRange(file, 0, 128));
    const version = macbinChunk[0];
    const nameLength = macbinChunk[1];
    const zeroFill = macbinChunk[74];
    const minMacbinVersion = macbinChunk[123];
    const dataForkLength =
        (macbinChunk[83] << 24) |
        (macbinChunk[84] << 16) |
        (macbinChunk[85] << 8) |
        macbinChunk[86];
    const fileCrc = macbinChunk[124] << 8 | macbinChunk[125];
    const crc = macbinCrc(macbinChunk, 0, 124);
    if (0 !== version || nameLength > 63 || nameLength < 1 || 0 !== zeroFill ||
        minMacbinVersion > 123 || crc != fileCrc) {
        // Not a macbin file, just return entire file
        return file;
    } else {
        return new SliceFile(file, 128, 128 + dataForkLength);
    }
}
