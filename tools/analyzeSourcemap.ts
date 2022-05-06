import { readFileSync } from "fs";
import { SourceMapConsumer } from 'source-map';

function usage(): never {
    console.error('usage: analyzeSourcemap <source-map-path>');
    process.exit(1);
}

export async function analyzeSourcemap(args: string[]): Promise<void> {
    if (args.length !== 1) {
        usage();
    }

    let sourcemap: Buffer;

    try {
        sourcemap = readFileSync(args[0]);
    } catch (e) {
        console.error(e);
        return;
    }

    const fileCounts = new Map<string, number>();

    await SourceMapConsumer.with(sourcemap.toString('utf-8'), null, (consumer) => {
        consumer.computeColumnSpans();
        // consumer.eachMapping((mapping) => {
        //     const oldCount = fileCounts.get(mapping.source) || 0;
        //     fileCounts.set(mapping.source, oldCount + 1);
        //     console.log(mapping.generatedLine, mapping.generatedColumn, mapping.source);
        // });
        for (let i = 0; i < 123316; ++i) {
            const pos = consumer.originalPositionFor({ line: 1, column: i });
            const source = pos.source ?? 'unknown';
            const oldCount = fileCounts.get(source || 'unknown') || 0;
            fileCounts.set(source, oldCount + 1);
        }
        console.log('all?', consumer.hasContentsOfAllSources());
    });

    const filesSorted = [...fileCounts.keys()].sort((a, b) => {
        const aCount = fileCounts.get(a) || 0;
        const bCount = fileCounts.get(b) || 0;
        return aCount - bCount;
    });

    let total = 0;
    filesSorted.forEach(file => {
        const nBytes = fileCounts.get(file) || 0;
        console.log(file, nBytes);
        total += nBytes;
    });

    console.log('total', total);
}
