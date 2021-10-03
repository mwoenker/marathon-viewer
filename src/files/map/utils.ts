import { Reader, Writer } from '../binary-read'
import { Vec2 } from '../../vector2.js'

export const readPoint = (r: Reader): Vec2 => [r.int16(), r.int16()];

export const writePoint = (writer: Writer, point: Vec2): void => {
    writer.int16(point[0]);
    writer.int16(point[1]);
};

export const readList = <Type>(n: number, parseFunc: () => Type): Type[] => {
    const results = [];
    for (let i = 0; i < n; ++i) {
        results.push(parseFunc());
    }
    return results;
};

