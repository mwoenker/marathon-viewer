import { useEffect, useRef, useState } from "react"

interface ResizerProps {
    children: (width: number, height: number) => JSX.Element
}

export function Resizer({ children }: ResizerProps): JSX.Element {
    const [size, setSize] = useState<[number, number] | null>(null);
    const currentContainer = useRef<HTMLDivElement | null>(null);

    const resize = (element: HTMLDivElement | null) => {
        if (element) {
            const sizeChanged =
                size?.[0] !== element?.clientWidth ||
                size?.[1] !== element?.clientHeight;
            if (sizeChanged) {
                setSize([element.clientWidth, element.clientHeight]);
            }
        }
        currentContainer.current = element;
    };

    useEffect(() => {
        const callback = () => {
            resize(currentContainer.current);
        };
        callback();
        window.addEventListener('resize', callback);

        return () => {
            window.removeEventListener('resize', callback);
        };
    }, []);

    return (
        <div className="resizingContainer" ref={resize}>
            {size && children(size[0], size[1])}
        </div>
    );
}
