import { RandomAccess } from './files/binary-read';
import { ShapesHeader, Collection, Bitmap, readShapesHeaders, readCollection } from './files/shapes';
import { makeShadingTables, ColorTable } from './color';

interface CollectionWithShading extends Collection {
    clutShadingTables: ColorTable[][]
}

type CollectionSlot = 'loading' | CollectionWithShading

function parseShapeDescriptor(descriptor: number) {
    return {
        bitmapIndex: descriptor & 0xff,
        collectionIndex: (descriptor >> 8) & 0x1f,
        clutIndex: (descriptor >> 13) & 0x07,
    };
}

export class Shapes {
    file: RandomAccess;
    headers: ShapesHeader[] | null;
    collections: { [idx: number]: CollectionSlot }

    constructor(file: RandomAccess) {
        this.file = file;
        this.headers = null;
        readShapesHeaders(this.file).then(headers => {
            this.headers = headers;
        });
        this.collections = {};
    }

    loadCollection(index: number): void {
        if (this.headers && !this.collectionLoading(index)) {
            console.log(`loading collection ${index}...`);
            this.collections[index] = 'loading';
            readCollection(this.file, this.headers[index])
                .then((collection) => {
                    const clutShadingTables = collection.colorTables.map((table) => {
                        return makeShadingTables(table);
                    });
                    this.collections[index] = {
                        ...collection,
                        clutShadingTables,
                    };
                    console.log(`loaded collection ${index}`);
                })
                .catch((e) => {
                    console.error(e);
                });
        }
    }

    collectionLoading(index: number): boolean {
        const collection = this.collections[index];
        return collection === 'loading';
    }

    collectionLoaded(index: number): boolean {
        const collection = this.collections[index];
        return collection && collection !== 'loading';
    }

    getBitmap(descriptor: number): Bitmap | null {
        const { collectionIndex, bitmapIndex } = parseShapeDescriptor(descriptor);
        const collection = this.collections[collectionIndex];
        if (!collection) {
            this.loadCollection(collectionIndex);
            return null;
        } else if (collection === 'loading') {
            return null;
        } else {
            return collection?.bitmaps[bitmapIndex] || null;
        }
    }

    getShadingTables(descriptor: number): ColorTable[] | null {
        const { collectionIndex, clutIndex } = parseShapeDescriptor(descriptor);
        const collection = this.collections[collectionIndex];
        if (!collection) {
            this.loadCollection(collectionIndex);
            return null;
        } else if (collection === 'loading') {
            return null;
        } else {
            return collection.clutShadingTables[clutIndex];
        }
    }
}


