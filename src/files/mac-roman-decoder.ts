export class MacRomanEncoder {
    unicodeToMacRoman: Record<string, number>

    constructor() {
        this.unicodeToMacRoman = {};
        const decoder = new TextDecoder('x-mac-roman');
        const buffer = new Uint8Array(1);
        for (let i = 0; i < 256; ++i) {
            buffer[0] = i;
            const utf8 = decoder.decode(buffer);
            this.unicodeToMacRoman[utf8] = i;
        }
    }

    encode(str: string): ArrayBuffer {
        const codePoints = [...str];
        const result = new Uint8Array(codePoints.length);
        for (let i = 0; i < codePoints.length; ++i) {
            if (!(codePoints[i] in this.unicodeToMacRoman)) {
                throw new Error(`Invalid mac roman character: ${codePoints[i]}`);
            }
            result[i] = this.unicodeToMacRoman[codePoints[i]];
        }
        return result.buffer;
    }
}
