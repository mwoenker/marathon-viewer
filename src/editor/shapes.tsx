// This is a quick hack to display images from the shapes file

import { useState, useEffect, useRef } from 'react';
import { render } from 'preact/compat';

import { readShapes, AllShapes, Collection } from '../files/shapes';
import { JSXInternal } from 'preact/src/jsx';
import { HtmlInputFile } from '../files/binary-read';

const blackBytes = Uint8Array.of(0, 0, 0, 255);
const black = new Uint32Array(blackBytes.buffer)[0];

function calcColorTable(collection: Collection, idx: number) {
    if (!idx) {
        idx = 0;
    }
    const table = collection.colorTables[idx];
    const buf = new ArrayBuffer(4 * 256);
    const pixels = new Uint32Array(buf);
    const bytes = new Uint8Array(buf);

    pixels.fill(black);

    for (const entry of table) {
        const offset = 4 * entry.value;
        bytes[offset] = entry.r >> 8;
        bytes[offset + 1] = entry.g >> 8;
        bytes[offset + 2] = entry.b >> 8;
        bytes[offset + 3] = 255;
    }

    return pixels;
}

interface ShapeProps {
    collection: Collection,
    frameIndex: number,
    clutIndex: number,
}

function Shape({ collection, frameIndex, clutIndex }: ShapeProps) {
    const canvas = useRef<HTMLCanvasElement>(null);

    const colorTable = calcColorTable(collection, clutIndex);
    const bitmapIdx = collection.frames[frameIndex].bitmapIndex;
    //const bitmapIdx = frameIndex;
    const bitmap = -1 !== bitmapIdx
        ? collection.bitmaps[collection.frames[frameIndex].bitmapIndex]
        : null;

    useEffect(() => {
        if (canvas.current && bitmap) {
            const { width, height } = bitmap;
            const context = canvas.current.getContext('2d');

            if (!context) {
                throw new Error("Can't get 2d context for canvas");
            }

            const imgData = context.createImageData(2 * width, 2 * height);

            const pixels = new Uint32Array(imgData.data.buffer);

            for (let y = 0; y < height; ++y) {
                for (let x = 0; x < width; ++x) {
                    const srcIdx = bitmap.columnOrder
                        ? height * x + y
                        : width * y + x;
                    const dstIdx = 2 * (2 * width * y + x);
                    pixels[dstIdx] = colorTable[bitmap.data[srcIdx]];
                    pixels[dstIdx + 1] = colorTable[bitmap.data[srcIdx]];
                    pixels[dstIdx + 2 * width] =
                        colorTable[bitmap.data[srcIdx]];
                    pixels[dstIdx + 2 * width + 1] =
                        colorTable[bitmap.data[srcIdx]];
                }
            }

            context.putImageData(imgData, 0, 0);
            context.fillStyle = 'white';
            context.font = '14px sans';
            context.fillText(`${bitmap.offset},${bitmap.bytesPerRow},${bitmap.flags}`, 30, 30);
        }
    }, [collection, frameIndex, clutIndex]);

    if (!bitmap) {
        return null;
    }

    return <canvas
        style={{ backgroundColor: 'green' }}
        ref={canvas}
        width={bitmap.width * 2}
        height={bitmap.height * 2} />;
}

interface CollectionProps {
    collection: Collection | null,
    clutIndex: number
}

function Collection({ collection, clutIndex }: CollectionProps) {
    if (!collection) {
        return <div>Invalid Collection</div>;
    }
    return (
        <div>
            {collection.frames.map((frame, i) =>
                <Shape
                    key={i}
                    collection={collection}
                    frameIndex={i}
                    clutIndex={clutIndex} />
            )}
        </div>
    );
}

interface FileInfo {
    file: File,
    collections: AllShapes
}

function Shapes() {
    const [file, setFile] = useState<FileInfo | null>(null);
    const [collectionIndex, setCollectionIndex] = useState(0);
    const [clutIndex, setClutIndex] = useState(0);

    async function uploadFile(e: JSXInternal.TargetedEvent<HTMLInputElement>) {
        const file = e.currentTarget.files?.[0];
        if (file) {
            setFile({
                file: file,
                collections: await readShapes(new HtmlInputFile(file)),
            });
        }
    }

    const collections = file && file.collections ? file.collections : [];
    const currentCollection = (collectionIndex in collections)
        ? collections[collectionIndex]
        : null;
    const clutIndexes = currentCollection
        ? Object.keys(currentCollection.colorTables)
        : [];
    return (
        <>
            <input type="file" onChange={uploadFile} />
            <select onChange={e => {
                setClutIndex(0);
                setCollectionIndex(parseInt(e.currentTarget.value));
            }}
                value={collectionIndex}>
                {Object.entries(collections).map((c, i) =>
                    <option value={i} key={i}>{i}</option>
                )}
            </select>
            <select onChange={e => setClutIndex(parseInt(e.currentTarget.value))}
                value={clutIndex}>
                {clutIndexes.map((i) => <option value={i} key={i}>{i}</option>)}
            </select>
            <Collection collection={currentCollection} clutIndex={clutIndex} />
        </>
    );
}

const appElement = document.getElementById('app');
appElement && render(<Shapes />, appElement);
