export const readPoint = r => [r.int16(), r.int16()];

export const writePoint = (writer, point) => {
    writer.int16(point[0]);
    writer.int16(point[1]);
};

export const readList = (n, parseFunc) => {
    const results = [];
    for (let i = 0; i < n; ++i) {
        results.push(parseFunc());
    }
    return results;
};

export const writeList = (list, parseFunc) => {
    list.forEach(item => parseFunc(item));
};
