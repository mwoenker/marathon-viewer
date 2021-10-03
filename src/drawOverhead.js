import {
    v2scale,
    v2add,
    v2direction,
    isClockwise
} from './vector2';
import { ClipArea } from './clip';

import { Transformation } from './transform2d';

export function drawOverhead(canvas, player, world) {
    const top = -2;
    const left = -1;
    const right = 5;
    const bottom = 3;

    const { points, lines, edges, polygons } = world;

    const context = canvas.getContext('2d');
    context.fillStyle = 'green';
    context.fillRect(0, 0, canvas.width, canvas.height);

    const angle = player.secondsElapsed * 10;
    const radians = angle * Math.PI / 180;

    const fromWorld = (vo) => {
        const toView = new Transformation(player.position, player.facingAngle);
        const v = toView.unTransform(toView.transform(vo));
        return [
            canvas.width * (v[0] - left) / (right - left),
            canvas.height * (v[1] - top) / (bottom - top),
        ];
    };

    const drawLines = (color, ...points) => {
        context.save();
        context.strokeStyle = color;
        context.beginPath();
        context.moveTo(...fromWorld(points[0]));
        for (let i = 1; i < points.length; ++i) {
            context.lineTo(...fromWorld(points[i]));
        }
        context.stroke();
        context.restore();
    };

    const frustumLeftDirection = v2scale(5, v2direction(player.facingAngle - player.hFov / 2));
    const frustumRightDirection = v2scale(5, v2direction(player.facingAngle + player.hFov / 2));

    drawLines('yellow', [-0.5, 0], [0.5, 0]);
    drawLines('yellow', [0, -0.5], [0, 0.5]);

    drawLines('green', player.position, v2add(player.position, frustumLeftDirection));
    drawLines('green', player.position, v2add(player.position, frustumRightDirection));

    const toView = new Transformation(player.position, player.facingAngle);

    const drawPolygon = (polygonIndex, clipArea) => {
        const polygon = polygons[polygonIndex];

        for (const edgeIndex of polygon.edges) {
            const edge = edges[edgeIndex];
            const [p1, p2] = world.getEdgeVertices(edge);

            if (!isClockwise(player.position, p1, p2)) {
                continue;
            }

            drawLines('purple', p1, p2);

            const p1View = {
                position: toView.transform(p1),
                texX: 0,
            };
            const p2View = {
                position: toView.transform(p2),
                texX: 1,
            };

            const clippedLine = clipArea.clipLine(p1View, p2View);

            if (clippedLine) {
                if (edge.portalTo !== undefined && edge.portalTo !== null) {
                    const newClipArea = new ClipArea(clippedLine[0].position, clippedLine[1].position);
                    drawPolygon(edge.portalTo, clipArea);

                    context.save();
                    context.lineWidth = 3;
                    drawLines(
                        'cyan',
                        toView.unTransform(clippedLine[0].position),
                        toView.unTransform(clippedLine[1].position));
                    context.restore();

                } else {
                    context.save();
                    context.lineWidth = 3;
                    drawLines(
                        'red',
                        toView.unTransform(clippedLine[0].position),
                        toView.unTransform(clippedLine[1].position));
                    context.restore();
                }
            }
        }
    };

    const clipArea = new ClipArea(
        [-Math.tan(player.hFov / 2), 1],
        [Math.tan(player.hFov / 2), 1],
    );
    drawPolygon(player.polygon, clipArea);
}

