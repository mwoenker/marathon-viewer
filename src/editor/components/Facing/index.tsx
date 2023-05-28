import { useEffect } from "react";
import { useRef } from "react";
import colors from '../../colors';

interface FacingProps {
    facing: number // [0, 1), if outside of that range we'll wrap around
    onChange: (facing: number, isEphemeral: boolean) => void
    width: number
    height: number
}

type Handler = (e: MouseEvent) => void

export function Facing(props: FacingProps): JSX.Element {
    const mouseUpRef = useRef<Handler | null>(null);
    const mouseMoveRef = useRef<Handler | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const facingRef = useRef(props.facing);

    const drag = (event: MouseEvent) => {
        if (!canvasRef.current) {
            return;
        }

        const bounds = canvasRef.current.getBoundingClientRect();
        const x = event.clientX - bounds.x;
        const y = event.clientY - bounds.y;

        const cX = x - (props.width / 2);
        const cY = y - (props.height / 2);

        if (cX !== 0 && cY !== 0) {
            const facingRadians = Math.atan2(cY, cX);
            const facing = facingRadians / Math.PI / 2;
            props.onChange(facing, true);
            facingRef.current = facing; // set map state (ephemeral)
        }
    };

    const mouseUp = (event: MouseEvent) => {
        event.stopPropagation();
        event.preventDefault();
        if (mouseUpRef.current) {
            document.body.removeEventListener('mouseup', mouseUpRef.current);
            mouseUpRef.current = null;
        }
        if (mouseMoveRef.current) {
            document.body.removeEventListener('mousemove', mouseMoveRef.current);
            mouseMoveRef.current = null;
        }
        props.onChange(facingRef.current, false); // set permanently (non-ephemeral)
    };

    const mouseDown = (event: MouseEvent) => {
        event.stopPropagation();
        event.preventDefault();
        mouseUpRef.current = mouseUp;
        document.body.addEventListener('mouseup', mouseUp);
        mouseMoveRef.current = mouseMove;
        document.body.addEventListener('mousemove', mouseMove);
        drag(event);
    };

    const mouseMove = (event: MouseEvent) => {
        event.stopPropagation();
        if (mouseUpRef.current) {
            drag(event);
        }
    };

    useEffect(() => {
        const radians = props.facing * Math.PI * 2;
        const handleWidth = 10;
        const radius = Math.min(props.width, props.height) / 2
            - (handleWidth / 2);
        const handleX = (props.width / 2) + radius * Math.cos(radians);
        const handleY = (props.height / 2) + radius * Math.sin(radians);
        const trackWidth = 2;

        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');

        if (canvas && context) {
            context.clearRect(0, 0, canvas.width, canvas.height);

            // Draw track that handle rides in
            context.strokeStyle = `${trackWidth}px solid ${colors.facingTrack}`;
            context.beginPath();
            context.arc(
                canvas.width / 2, canvas.height / 2, radius, 0, 2 * Math.PI);
            context.stroke();

            // Draw handle
            context.strokeStyle = `${trackWidth}px solid ${colors.facingLever}`;
            context.beginPath();
            context.moveTo(canvas.width / 2, canvas.height / 2);
            context.lineTo(handleX, handleY);
            context.stroke();

            context.fillStyle = colors.facingHandle;
            context.beginPath();
            context.arc(handleX, handleY, handleWidth / 2, 0, 2 * Math.PI);
            context.fill();
        }
    }, [props.width, props.height, props.facing]);

    return (
        <canvas
            className='facingCanvas'
            style={{
                width: props.width,
                height: props.height,
            }}
            width={props.width}
            height={props.height}
            onMouseDown={mouseDown}
            ref={canvasRef}
        >
        </canvas>
    );
}
