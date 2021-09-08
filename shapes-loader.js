import { readShapesHeaders, readCollection } from './files/shapes.js';
import { makeShadingTables } from './color.js';

const dummyTexture = {
    width: 2,
    height: 2,
    bytesPerRow: 128,
    flags: 32768,
    bitDepth: 8,
    offset: 3932,
    columnOrder: true,
    data: [
        
    ]
};

function parseShapeDescriptor(descriptor) {
    return {
        bitmapIndex: descriptor & 0xff,
        collectionIndex: (descriptor >> 8) & 0x1f,
        clutIndex: (descriptor >> 13) & 0x07,
    };
}

export class Shapes {
    constructor(file) {
        this.file = file;
        this.headers = null;
        readShapesHeaders(this.file).then(headers => {
            this.headers = headers;
        });
        this.collections = {};
    }

    loadCollection(index, it) {
        if (this.headers && ! this.collectionLoading(index)) {
            console.log(`loading collection ${index}...`);
            this.collections[index] = { loading: true };
            readCollection(this.file, this.headers[index])
                .then((collection) => {
                    collection.clutShadingTables = collection.colorTables.map((table) => {
                        return makeShadingTables(table);
                    });                    
                    this.collections[index] = {...collection };
                    console.log(`loaded collection ${index}`);
                })
                .catch((e) => {
                    console.error(it, e);
                });
        }
    }

    collectionUnloaded(index) {
        return ! this.colections[index];
    }

    collectionLoading(index) {
        const collection = this.collections[index];
        return collection && collection.loading;
    }
        
    collectionLoaded(index) {
        const collection = this.collections[index];
        return collection && ! collection.loading;
    }

    getBitmap(descriptor) {
        const {collectionIndex, clutIndex, bitmapIndex} = parseShapeDescriptor(descriptor);
        if (! this.collectionLoaded(collectionIndex)) {
            this.loadCollection(collectionIndex, {collectionIndex, clutIndex, bitmapIndex});
            return null;
        } else {
            const collection = this.collections[collectionIndex];
            const bitmap = collection.bitmaps[bitmapIndex];
            const withShading = {
                ...bitmap,
                shadingTables: collection.clutShadingTables[clutIndex],
            };
            return withShading;
        }
    }
}
    

