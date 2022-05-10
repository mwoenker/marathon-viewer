import { useEffect, useRef } from "preact/hooks";
import { ColorTable } from "../../../color";
import { Bitmap } from "../../../files/shapes";

export interface ShapeProps {
    bitmap: Bitmap;
    colorTable: ColorTable | null;
    selected: boolean;
    onClick?: () => void
}

export function Shape({ bitmap, colorTable, selected, onClick }: ShapeProps): JSX.Element {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;

        if (!canvas || !colorTable) {
            return;
        }

        const context = canvas.getContext('2d');
        if (!context) {
            console.error("Can't get canvas context");
            return;
        }

        const imageData = context.createImageData(bitmap.width, bitmap.height);
        const pixels = new Uint32Array(imageData.data.buffer);

        for (let y = 0; y < bitmap.height; ++y) {
            for (let x = 0; x < bitmap.width; ++x) {
                let src: number;

                if (bitmap.columnOrder) {
                    src = bitmap.data[bitmap.height * x + y];
                } else {
                    src = bitmap.data[bitmap.width * y + x];
                }

                pixels[y * bitmap.width + x] = colorTable[src];
            }
        }

        context.putImageData(imageData, 0, 0);
    }, [bitmap]);

    function click() {
        typeof onClick === 'function' && onClick();
    }

    const className = selected ? 'texture-selected' : 'texture';

    return (
        <canvas
            width={bitmap.width}
            height={bitmap.height}
            ref={canvasRef}
            className={className}
            onClick={click}
        >
        </canvas>
    );
}
