import { v2direction, v3tov2, Vec2, v2add, v2scale } from '../../vector2';
import { Viewport } from './viewport';
import { MapGeometry } from '../../files/map';
import colors from '../colors';
import { getNonConvexPattern, objectColor } from './util';
import { Selection } from '../state';
import { isConvex } from '../../geometry';
import { ObjectType } from '../../files/map/object';
import { numFixedAngles, worldUnitSize } from '../../constants';
import { DrawOperation } from '../state/drawOperation';
import { ColorComponents, getCssColor } from '../../color';

const pointWidth = 3;
const selectedPointWidth = 6;

interface GridBounds {
    left: number
    right: number
    top: number
    bottom: number
}

type GetPolygonColor = (polygonIndex: number) => ColorComponents

export class MapDraw {
    context: CanvasRenderingContext2D

    constructor(
        private map: MapGeometry | undefined,
        private selection: Selection,
        private canvas: HTMLCanvasElement,
        private viewport: Viewport,
        private drawOperation: DrawOperation | undefined,
        private getPolygonColor: GetPolygonColor,
        private gridSpacing: number,
    ) {
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error("Can't get 2d context for map renderer");
        }
        this.context = context;
    }

    private drawObjects(map: MapGeometry) {
        this.context.save();
        map.objects.forEach((obj, i) => {
            const selected = this.selection.objType === 'object' &&
                this.selection.index === i;

            if (obj.type === ObjectType.monster || obj.type === ObjectType.player) {
                const radians = obj.facing / numFixedAngles * Math.PI * 2;
                const forward = v2direction(radians);
                const left = v2direction(radians - (Math.PI / 2));
                const pos = this.viewport.toPixel(v3tov2(obj.position));
                const front = v2add(pos, v2scale(8, forward));
                const back = v2add(pos, v2scale(-8, forward));
                const backLeft = v2add(back, v2scale(4, left));
                const backRight = v2add(back, v2scale(-4, left));

                this.context.fillStyle = objectColor(obj.type);
                this.context.lineWidth = selected ? 2 : 1;
                this.context.strokeStyle = 'black';
                this.context.beginPath();
                this.context.moveTo(...front);
                this.context.lineTo(...backLeft);
                this.context.lineTo(...backRight);
                this.context.lineTo(...front);
                this.context.fill();
                this.context.stroke();
            } else {
                const width = selected ? 11 : 7;
                this.context.fillStyle = objectColor(obj.type);
                const [x, y] = this.viewport.toPixel([obj.position[0], obj.position[1]]);
                this.context.beginPath();
                const adjust = (width - 1) / 2;
                this.context.rect(x - adjust, y - adjust, width, width);
                this.context.fill();
            }
        });
        this.context.restore();
    }

    private drawPoints(map: MapGeometry) {
        this.context.save();
        map.points.forEach((point: Vec2, i: number) => {
            const selected =
                'point' === this.selection.objType && i === this.selection.index;
            const width = selected ? selectedPointWidth : pointWidth;
            const color = selected ? colors.selectedPoint : colors.point;
            const pos = this.viewport.toPixel(point);
            this.context.fillStyle = color;
            this.context.beginPath();
            this.context.rect(
                pos[0] - (width / 2),
                pos[1] - (width / 2),
                width,
                width);
            this.context.fill();
        });
        this.context.restore();
    }

    private drawLines(map: MapGeometry) {
        this.context.save();
        map.lines.forEach((line, i: number) => {
            const begin = map.points[line.begin];
            const end = map.points[line.end];

            const isSelected =
                'line' === this.selection.objType && i === this.selection.index;
            const inSelectedPoly = 'polygon' === this.selection.objType &&
                [line.frontPoly, line.backPoly].includes(this.selection.index);
            const isPortal = line.frontPoly != -1 && line.backPoly != -1;
            let color = colors.line;

            if (isSelected) {
                color = colors.lineSelected;
            } else if (isPortal) {
                color = colors.portalLine;
            } else if (inSelectedPoly) {
                color = colors.lineInSelectedPoly;
            }

            this.context.lineWidth = isSelected ? 5 : 1;
            this.context.strokeStyle = color;
            this.context.beginPath();
            this.context.moveTo(...this.viewport.toPixel(begin));
            this.context.lineTo(...this.viewport.toPixel(end));
            this.context.stroke();
        });
        this.context.restore();
    }

    private drawPolygons(map: MapGeometry) {
        this.context.save();
        const nonConvexWarningPattern = getNonConvexPattern();
        map.polygons.forEach((poly, i: number) => {
            const nPoints = poly.vertexCount;
            const points = poly.endpoints.slice(0, nPoints).map(
                (idx: number) => map.points[idx]);
            const selected = 'polygon' === this.selection.objType
                && i === this.selection.index;

            const color = selected
                ? colors.selectedPolygon
                : getCssColor(this.getPolygonColor(i));
            // : colors.polygon;

            const drawPoly = (points: Vec2[]) => {
                this.context.beginPath();
                this.context.moveTo(...this.viewport.toPixel(points[0]));
                for (let i = 1; i < points.length; ++i) {
                    this.context.lineTo(...this.viewport.toPixel(points[i]));
                }
                this.context.fill();
            };

            this.context.fillStyle = color;
            drawPoly(points);

            if (!isConvex(points)) {
                this.context.fillStyle = nonConvexWarningPattern;
                drawPoly(points);
            }
        });
        this.context.restore();
    }

    private drawRulerLines(gridBounds: GridBounds) {
        this.context.save();

        // Draw ruler lines
        this.context.strokeStyle = colors.ruleLine;
        for (let y = gridBounds.top - (gridBounds.top % this.gridSpacing);
            y <= gridBounds.bottom;
            y += this.gridSpacing) {
            this.context.beginPath();
            this.context.moveTo(...this.viewport.toPixel([gridBounds.left, y]));
            this.context.lineTo(...this.viewport.toPixel([gridBounds.right, y]));
            this.context.stroke();
        }

        for (let x = gridBounds.left - (gridBounds.left % this.gridSpacing);
            x <= gridBounds.right;
            x += this.gridSpacing) {
            this.context.beginPath();
            this.context.moveTo(...this.viewport.toPixel([x, gridBounds.top]));
            this.context.lineTo(...this.viewport.toPixel([x, gridBounds.bottom]));
            this.context.stroke();
        }

        this.context.restore();
    }

    drawWorldUnitMarkers(gridBounds: GridBounds): void {
        this.context.save();

        const markerRadius = 1.5;
        this.context.fillStyle = colors.wuMarker;
        for (let y = gridBounds.top - (gridBounds.top % worldUnitSize); y <= gridBounds.bottom; y += worldUnitSize) {
            for (let x = gridBounds.left - (gridBounds.left % worldUnitSize);
                x <= gridBounds.right;
                x += worldUnitSize) {
                this.context.beginPath();
                const [sx, sy] = this.viewport.toPixel([x, y]);
                this.context.moveTo(sx - markerRadius, sy - markerRadius);
                this.context.lineTo(sx + markerRadius, sy - markerRadius);
                this.context.lineTo(sx + markerRadius, sy + markerRadius);
                this.context.lineTo(sx - markerRadius, sy + markerRadius);
                this.context.fill();
            }
        }

        this.context.restore();
    }

    private drawDrawOperation(): void {
        if (this.drawOperation && this.map) {
            const start = this.map.points[this.drawOperation.startPointIndex];
            const end = this.drawOperation.endPoint;
            this.context.beginPath();
            this.context.moveTo(...this.viewport.toPixel(start));
            this.context.lineTo(...this.viewport.toPixel(end));
            this.context.stroke();
        }
    }

    draw(): void {
        const dimMin = -0x8000;
        const dimMax = 0x7fff;

        const { width, height, left, top, right, bottom } = this.viewport;

        // Draw background
        this.context.beginPath();
        this.context.rect(0, 0, width, height);
        this.context.fillStyle = colors.background;
        this.context.fill();

        const gridBounds = {
            left: Math.max(dimMin, left),
            right: Math.min(dimMax, right),
            top: Math.max(dimMin, top),
            bottom: Math.min(dimMax, bottom),
        };

        this.drawRulerLines(gridBounds);
        this.drawWorldUnitMarkers(gridBounds);

        if (this.map) {
            this.drawPolygons(this.map);
            this.drawLines(this.map);
            this.drawPoints(this.map);
            this.drawObjects(this.map);
        }

        this.drawDrawOperation();
    }
}
