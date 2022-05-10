import { RandomAccess } from './files/binary-read';
import { ShapesHeader, Collection, Bitmap, readShapesHeaders, readCollection, parseShapeDescriptor } from './files/shapes';
import { makeShadingTables, ColorTable } from './color';

export interface CollectionWithShading extends Collection {
    clutShadingTables: ColorTable[][]
}

type CollectionSlot = 'loading' | CollectionWithShading

type CollectionLoadListener = (
    collectionIndex: number,
    collection: CollectionWithShading
) => void

export class Shapes {
    private file: RandomAccess;
    private headers: ShapesHeader[] | null;
    private collections: { [idx: number]: CollectionSlot }
    private collectionLoadListeners: CollectionLoadListener[] = []

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
                    const newCollection = this.collections[index] = {
                        ...collection,
                        clutShadingTables,
                    };
                    this.collectionLoadListeners.forEach(listener =>
                        listener(index, newCollection));
                    console.log(`loaded collection ${index}`);
                })
                .catch((e) => {
                    console.error(e);
                });
        }
    }

    getCollection(collectionIndex: number): null | CollectionWithShading {
        const collection = this.collections[collectionIndex];
        if (!collection) {
            this.loadCollection(collectionIndex);
            return null;
        } else if (collection === 'loading') {
            return null;
        } else {
            return collection;
        }
    }

    addLoadListener(listener: CollectionLoadListener): void {
        this.collectionLoadListeners.push(listener);
    }

    removeLoadListener(listener: CollectionLoadListener): void {
        this.collectionLoadListeners = this.collectionLoadListeners.filter(
            member => member === listener);
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
        const collection = this.getCollection(collectionIndex);
        if (collection) {
            return collection.bitmaps[bitmapIndex] ?? null;
        } else {
            return null;
        }
    }

    getShadingTables(descriptor: number): ColorTable[] | null {
        const { collectionIndex, clutIndex } = parseShapeDescriptor(descriptor);
        const collection = this.getCollection(collectionIndex);
        if (collection) {
            return collection.clutShadingTables[clutIndex];
        } else {
            return null;
        }
    }
}


