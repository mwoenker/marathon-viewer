const fs = require('fs');

class Reader {
    constructor(arrayBuffer) {
        this.bytes = new Uint8Array(arrayBuffer);
        this.pos = 0;
        this.decoder = new TextDecoder('x-mac-roman');
    }
    spaceRemaining() {
        return this.bytes.byteLength - this.pos;
    }
    eof() {
        return 0 === this.spaceRemaining();
    }
    requireSpace(nBytes) {
        if (this.spaceRemaining() < nBytes) {
            throw new Error("unexpected end");
        }
    }
    uint8() {
        this.requireSpace(1);
        return this.bytes[this.pos++];
    }
    uint16() {
        this.requireSpace(2);
        return (this.uint8()) << 8 | this.uint8();
    }
    uint32() {
        this.requireSpace(4);
        return (this.uint16() * (1 << 16)) + this.uint16();
    }
    int8() {
        this.requireSpace(1);
        const u = this.uint8();
        return (u << 24) >> 24; // sign extend
    }
    int16() {
        this.requireSpace(2);
        const u = this.uint16();
        return (u << 16) >> 16; // sign extend
    }
    int32() {
        this.requireSpace(4);
        return (this.uint16() << 16) | this.uint16();
    }
    raw(length) {
        this.requireSpace(length);
        let bytes = this.bytes.slice(this.pos, this.pos + length);
        this.pos += length;
        return bytes;
    }
    fixString(length) {
        return this.decoder.decode(this.raw(length));
    }
    cString(maxlen) {
        let bytes = this.raw(maxlen);
        for (let i = 0; i < bytes.length; ++i) {
            if (0 === bytes[i]) {
                bytes = bytes.slice(0, i);
                break;
            }
        }
        return this.decoder.decode(bytes);
    }
    pascalString(nBytes) {
        let bytes = this.raw(nBytes);
        return this.decoder.decode(bytes.slice(1, 1 + bytes[0]));
    }
    skip(nBytes) {
        this.requireSpace(nBytes);
        this.pos += nBytes;
    }
    seek(pos) {
        if (pos >= this.bytes.byteLength) {
            throw new Error('Seek past end of data');
        }
        this.pos = pos;
    }
}

async function readRange(file, start, stop) {
    return file.buffer.slice(start, stop);

    // const slice = file.slice(start, stop).buffer;
    // const reader = new FileReader();
    // return new Promise((resolve, reject) => {
    //     reader.onerror = (e) => reject(new Error("read error"));
    //     reader.onload = (e) => resolve(reader.result);
    //     reader.readAsArrayBuffer(slice);
    // });
}

// function macbinCrc(bytes, start, end) {
//     let crc = 0;
//     for (let i = start; i < end; ++i) {
// 	let data = bytes[i] << 8;
// 	for (let j = 0; j < 8; ++j) {
// 	    if ((data ^ crc) & 0x8000) {
// 		crc = 0xffff & ((crc << 1) ^ 0x1021);
// 	    } else {
//                 crc = 0xffff & (crc << 1);
//             }
//             data = 0xffff & (data << 1);
// 	}
//     }
//     return crc;
// }

// async function getDataFork(file) {
//     const macbinChunk = new Uint8Array(await readRange(file, 0, 128));
//     const version = macbinChunk[0];
//     const nameLength = macbinChunk[1];
//     const zeroFill = macbinChunk[74];
//     const minMacbinVersion = macbinChunk[123];
//     const dataForkLength =
//           (macbinChunk[83] << 24) |
//           (macbinChunk[84] << 16) |
//           (macbinChunk[85] << 8) |
//           macbinChunk[86];
//     const fileCrc = macbinChunk[124] << 8 | macbinChunk[125];
//     const crc = macbinCrc(macbinChunk, 0, 124);

//     if (0 !== version || nameLength > 63 || 0 !== zeroFill ||
//         minMacbinVersion > 123 ||  crc != fileCrc)
//     {
//         // Not a macbin file, just return entire file
//         return file;
//     } else {
//         return file.slice(128, 128 + dataForkLength);
//     }
// }

const nCollections = 32;
const collectionHeaderSize = 32;

// See shape_descriptors.h in aleph one
const collectionIndex = {
    wall: {
        water: 17,
        lava: 18,
        sewage: 19,
        jjaro: 20,
        pfhor: 21,
    },
    scenery: {
        water: 22,
        lava: 23,
        sewage: 24,
        jjaro: 25,
        pfhor: 26,
    },
    landscape: {
        day: 27,
        night: 28,
        moon: 29,
        space: 30,
    },
};

const COLUMN_ORDER_BIT = 0x8000;
const SELF_LUMINESCENT_BIT = 0x80;

function readColorTable(bytes, colorsPerTable) {
    const r = new Reader(bytes);
    
    const table = [];
    for (let i = 0; i < colorsPerTable; ++i) {
        table.push({
            flags: r.uint8(),
            value: r.uint8(),
            r: r.uint16(),
            g: r.uint16(),
            b: r.uint16(),
        });
    }
    return table;
}

function readColorTables(bytes, collection) {
    const tables = [];
    for (let i = 0; i < collection.colorTableCount; ++i) {
        const colorSize = 8;
        const tableSize = collection.colorsPerTable * colorSize;
        const tableBase = collection.colorTablesOffset + i * tableSize;
        const tableBytes = bytes.slice(tableBase, tableBase + tableSize);
        tables.push(readColorTable(tableBytes, collection.colorsPerTable));
    }

    return tables;
}

function readBitmap(bytes, offset) {
    const r = new Reader(bytes.slice(offset));

    const bitmap = {
        width: r.int16(),
        height: r.int16(),
        bytesPerRow: r.int16(),
        flags: r.uint16(),
        bitDepth: r.int16(),
        offset: offset,
    };

    const columnOrder = 0 != (bitmap.flags & COLUMN_ORDER_BIT);
    bitmap.columnOrder = columnOrder;
    
    const nSlices = columnOrder ? bitmap.width : bitmap.height;
    const sliceSize = columnOrder ? bitmap.height : bitmap.width;

    console.assert(bitmap.width <= 2048);
    console.assert(bitmap.height <= 2048);
    console.assert(-1 === bitmap.bytesPerRow ||
                   sliceSize === bitmap.bytesPerRow);
    console.assert(8 === bitmap.bitDepth);
    
    r.skip(20);
    r.skip(4 * nSlices);

    if (bitmap.bytesPerRow < 0) {
        bitmap.data = new Uint8Array(bitmap.width * bitmap.height);
        for (let i = 0; i < nSlices; ++i) {
            const begin = r.int16();
            const end = r.int16();
            console.assert(begin >= 0 && begin < 2048);
            console.assert(end >= 0 && end < 2048);
            for (let j = begin; j < end; ++j) {
                bitmap.data[sliceSize * i + j] = r.uint8();
            }
        }
    } else {
        bitmap.data = r.raw(bitmap.width * bitmap.height);
    }

    return bitmap;
}

function readBitmaps(bytes, collection) {
     const r = new Reader(bytes.slice(
        collection.bitmapTableOffset,
        collection.bitmapTableOffset + 4 * collection.bitmapCount));

    const bitmaps = [];
    for (let i = 0; i < collection.bitmapCount; ++i) {
        const offset = r.int32();
        bitmaps.push(readBitmap(bytes, offset));
    }
    return bitmaps;
}

function readFrame(bytes, offset) {
    const r = new Reader(bytes.slice(offset, offset + 36));

    return {
        flags: r.int16(),
        minimumLighIntensity: r.int32(),
        bitmapIndex: r.int16(),
        origin: [r.int16(), r.int16()],
        key: [r.int16(), r.int16()],
        worldLeft: r.int16(),
        worldRight: r.int16(),
        worldTop: r.int16(),
        worldBottom: r.int16(),
        world: [r.int16(), r.int16()],
    };
}

function readFrames(bytes, collection) {
     const r = new Reader(bytes.slice(
        collection.frameTableOffset,
        collection.frameTableOffset + 4 * collection.frameCount));

    const frames = [];
    for (let i = 0; i < collection.frameCount; ++i) {
        const offset = r.int32();
        frames.push(readFrame(bytes, offset));
    }

    return frames;
}

function readSequence(bytes, offset) {
    const r = new Reader(bytes.slice(offset, offset + 88));

    const seq =  {
        type: r.int16(),
        flags: r.uint16(),
        name: r.pascalString(34),
        numberOfViews: r.int16(),
        framesPerView: r.int16(),
        ticksPerFrame: r.int16(),
        keyFrame: r.int16(),
        transferMode: r.int16(),
        transferModePeriod: r.int16(),
        firstFrameSound: r.int16(),
        keyFrameSound: r.int16(),
        lastFrameSound: r.int16(),
        scaleFactor: r.int16(),
        loopFrame: r.int16(),
    };
    
    return seq;
}

// Sequence, aka high level shapes in marathon terminology
function readSequences(bytes, collection) {
    const r = new Reader(bytes.slice(
        collection.sequenceTableOffset,
        collection.sequenceTableOffset + 4 * collection.sequenceCount));

    const sequences = [];
    for (let i = 0; i < collection.sequenceCount; ++i) {
        const offset = r.int32();
        sequences.push(readSequence(bytes, offset));
    }

    return sequences;
}

async function readCollection(file, header) {
    let offset, length;
    if (header.offset16 <= 0 || header.length16 <= 0) {
        offset = header.offset8;
        length = header.length8;
    } else {
        offset = header.offset16;
        length = header.offset16;
    }
    if (offset <= 0 || length <= 0) {
        return null;
    }

    const collectionBytes = await readRange(file, offset, offset + length);
    const r = new Reader(collectionBytes);
    
    const collection = {
        header: header,
        version: r.int16(),
	type: r.int16(),
        flags: r.uint16(),
	colorsPerTable: r.int16(),
        colorTableCount: r.int16(),
        colorTablesOffset: r.int32(),
        sequenceCount: r.int16(),
        sequenceTableOffset: r.int32(),
        frameCount: r.int16(),
        frameTableOffset: r.int32(),
        bitmapCount: r.int16(),
        bitmapTableOffset: r.int32(),
        scaleFactor: r.int16(),
        collectionSize: r.int32(),
    };

    collection.sequences = readSequences(collectionBytes, collection);
    collection.frames = readFrames(collectionBytes, collection);
    collection.bitmaps = readBitmaps(collectionBytes, collection);
    collection.colorTables = readColorTables(collectionBytes, collection);
    return collection;
}

async function readShapes(file) {
    const r = new Reader(await readRange(
        file,
        0,
        nCollections * collectionHeaderSize));
    const headers = [];
    for (let i = 0; i < nCollections; ++i) {
        const header = {
            status: r.int16(),
            flags: r.uint16(),
            offset8: r.int32(),
            length8: r.int32(),
            offset16: r.int32(),
            length16: r.int32(),
        };
        r.skip(12);
        headers.push(header);
    }

    // const collectionIndexes = Object.values(collectionIndex).flatMap(
    //     category => Object.values(category));
    const collectionIndexes = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
        20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31];
    const promises = collectionIndexes.map(
        async i => [i, await readCollection(file, headers[i])]);
    return Object.fromEntries(await Promise.all(promises));
}

function exportCollection(shapes, collectionIndex, filename) {
    const collection = shapes[collectionIndex];
    console.log(collection.bitmaps);
    // assume no rle, because wall shapes

    const bitmaps = collection.bitmaps.map(bitmap => ({
            ...bitmap,
            data: [...bitmap.data],
    }));
    const bitmapsJSON = JSON.stringify(bitmaps, null, 4);
    const colorTableJSON = JSON.stringify(collection.colorTables[0], null, 4);
    const declarations = `export const bitmaps = ${bitmapsJSON};\n\nexport const colorTable = ${colorTableJSON};\n`;

    fs.writeFileSync(filename, declarations);
}

async function main() {
    const shapes = await readShapes(fs.readFileSync(process.argv[2]));
    exportCollection(shapes, collectionIndex.wall.jjaro, 'shapes-jjaro-inf.js');
    exportCollection(shapes, collectionIndex.wall.lava, 'shapes-lava-inf.js');
    exportCollection(shapes, collectionIndex.wall.water, 'shapes-water-inf.js');
    exportCollection(shapes, collectionIndex.wall.sewage, 'shapes-sewage-inf.js');
    exportCollection(shapes, collectionIndex.wall.pfhor, 'shapes-pfhor-inf.js');
}

main()
    .then(() => process.exit())
    .catch(e => {
        console.error(e);
        process.exit(1);
    });
