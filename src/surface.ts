import { MapGeometry } from "./files/map";
import { Polygon } from "./files/map/polygon";
import { impossibleValue } from "./utils";
import { Vec2, v2, v2dist } from "./vector2";

export type WallSurfaceType = 'wallPrimary' | 'wallSecondary' | 'wallTransparent'
export type FloorSurfaceType = 'floor' | 'ceiling'

export interface FloorOrCeilingSurface {
    readonly type: FloorSurfaceType;
    readonly polygonIndex: number;
}

export interface WallSurface {
    readonly type: WallSurfaceType;
    readonly polygonIndex: number;
    readonly wallIndex: number;
}

export type Surface = FloorOrCeilingSurface | WallSurface;

export type SurfacePredicate = (surface: Surface) => boolean;

export interface TexturedSurface<SurfaceType extends Surface = Surface> {
    readonly texOffset: Vec2
    readonly surface: SurfaceType
}

interface LineLocator {
    readonly polygonIndex: number
    readonly lineIndex: number
    readonly horizontalTexOffset: number
}

export function surfacesEqual(a: Surface, b: Surface): boolean {
    switch (a.type) {
        case 'wallPrimary':
        case 'wallSecondary':
        case 'wallTransparent':
            return a.type === b.type &&
                a.polygonIndex === b.polygonIndex &&
                a.wallIndex === b.wallIndex;
        case 'floor':
        case 'ceiling':
            return a.type === b.type &&
                a.polygonIndex === b.polygonIndex;
        default:
            impossibleValue(a);
    }
}

function horizontalSurfaceHeight(map: MapGeometry, surface: FloorOrCeilingSurface) {
    const polygon = map.getPolygon(surface.polygonIndex);
    if (surface.type === 'ceiling') {
        return polygon.ceilingHeight;
    } else if (surface.type === 'floor') {
        return polygon.floorHeight;
    } else {
        impossibleValue(surface.type);
    }
}

function getConnectedHorizontalSurfaces(
    map: MapGeometry,
    surface: FloorOrCeilingSurface,
    extraCriteria?: SurfacePredicate
): TexturedSurface[] {
    const height = horizontalSurfaceHeight(map, surface);
    const criteria = (polygonIndex: number) => {
        const connectedSurface = {
            type: surface.type,
            polygonIndex
        };
        if (horizontalSurfaceHeight(map, connectedSurface) !== height) {
            return false;
        }
        if (extraCriteria && !extraCriteria(connectedSurface)) {
            return false;
        }
        return true;
    };

    const surfaces: TexturedSurface[] = [];

    for (const polygonIndex of map.floodBreadthFirst(surface.polygonIndex, criteria)) {
        surfaces.push({
            texOffset: [0, 0],
            surface: {
                type: surface.type,
                polygonIndex
            }
        });
    }

    return surfaces;
}

interface SurfaceExtents {
    bottom: number,
    top: number
}

function extentsOverlap(a: SurfaceExtents, b: SurfaceExtents) {
    return !(a.bottom > b.top || b.bottom > a.top);
}

function surfaceExtents(map: MapGeometry, surface: WallSurface): SurfaceExtents {
    const polygon = map.getPolygon(surface.polygonIndex);
    const neighborIndex = map.getPortal(surface.polygonIndex, surface.wallIndex);
    if (neighborIndex >= 0 && neighborIndex <= map.lines.length) {
        const neighbor = map.getPolygon(neighborIndex);
        const portalTop = Math.min(polygon.ceilingHeight, neighbor.ceilingHeight);
        const portalBottom = Math.max(polygon.floorHeight, neighbor.floorHeight);

        if (surface.type === 'wallPrimary') {
            if (polygon.ceilingHeight > portalTop) {
                return {
                    bottom: portalTop,
                    top: polygon.ceilingHeight
                };
            } else {
                return {
                    bottom: polygon.floorHeight,
                    top: portalBottom
                };
            }
        } else if (surface.type === 'wallSecondary') {
            return {
                bottom: polygon.floorHeight,
                top: portalBottom
            };
        } else if (surface.type === 'wallTransparent') {
            return {
                bottom: portalBottom,
                top: portalTop
            };
        } else {
            impossibleValue(surface.type);
        }
    } else {
        // solid wall with no neighbor
        return {
            bottom: polygon.floorHeight,
            top: polygon.ceilingHeight
        };
    }
}

function lineSurfaces(map: MapGeometry, wall: LineLocator): WallSurface[] {
    const surfaces: WallSurface[] = [];
    const addSurface = (type: WallSurfaceType) => surfaces.push({
        type,
        polygonIndex: wall.polygonIndex,
        wallIndex: wall.lineIndex
    });

    const polygon = map.getPolygon(wall.polygonIndex);
    const neighborIndex = map.getPortal(wall.polygonIndex, wall.lineIndex);
    if (neighborIndex >= 0 && neighborIndex <= map.lines.length) {
        const neighbor = map.getPolygon(neighborIndex);
        const portalTop = Math.min(polygon.ceilingHeight, neighbor.ceilingHeight);
        const portalBottom = Math.max(polygon.floorHeight, neighbor.floorHeight);
        if (polygon.ceilingHeight > portalTop) {
            addSurface('wallPrimary');
            if (polygon.floorHeight < portalBottom) {
                addSurface('wallSecondary');
            }
        } else if (polygon.floorHeight < portalBottom) {
            addSurface('wallPrimary');
        }
        addSurface('wallTransparent');
    } else {
        // solid wall with no neighbor
        addSurface('wallPrimary');
    }

    return surfaces;
}

function lineSolidSurfaces(map: MapGeometry, wall: LineLocator): WallSurface[] {
    return lineSurfaces(map, wall).filter(surface => surface.type !== 'wallTransparent');
}

type Direction = 'clockwise' | 'counterclockwise'

function nextIndexInPoly(polygon: Polygon, index: number, direction: Direction): number {
    if (direction === 'clockwise') {
        return (index + 1) % polygon.vertexCount;
    } else if (direction === 'counterclockwise') {
        return (index + polygon.vertexCount - 1) % polygon.vertexCount;
    } else {
        impossibleValue(direction);
    }
}

function lineEndpointIndex(polygon: Polygon, lineIndex: number, direction: Direction): number {
    if (direction === 'clockwise') {
        return (lineIndex + 1) % polygon.vertexCount;
    } else {
        return lineIndex;
    }
}

function lineIndexForPoint(polygon: Polygon, polygonPointIndex: number, direction: Direction): number {
    if (direction === 'clockwise') {
        return polygonPointIndex;
    } else {
        return (polygonPointIndex + polygon.vertexCount - 1) % polygon.vertexCount;
    }
}

function lineLength(map: MapGeometry, polygonIndex: number, polygonSideIndex: number): number {
    const line = map.getPolygonLine(polygonIndex, polygonSideIndex);
    const startPoint = map.getPoint(line.begin);
    const endPoint = map.getPoint(line.end);
    return v2dist(startPoint, endPoint);
}

function calculateTexOffset(
    startOffset: number,
    direction: Direction,
    originLineLength: number,
    visitedLineLength: number
) {
    if (direction === 'clockwise') {
        return startOffset + originLineLength;
    } else if (direction === 'counterclockwise') {
        return startOffset - visitedLineLength;
    } else {
        impossibleValue(direction);
    }
}

// A line "b" is connected to a line "a" if they share a vertex v, and one of the following is true
// 1. They are in the same polygon
// 2. Line b is in a different polygon and shares vertex v with one or more lines that are portals
// between polygons, and which transitively connect the two polygons that line a and b are inside.

function getConnectingLines(
    map: MapGeometry,
    startLine: LineLocator,
    direction: Direction,
): LineLocator[] {
    const polygon = map.getPolygon(startLine.polygonIndex);
    const polygonPointIndex = lineEndpointIndex(polygon, startLine.lineIndex, direction);
    const pointIndex = polygon.endpoints[polygonPointIndex];
    const lines: LineLocator[] = [];

    const originLineLength = lineLength(map, startLine.polygonIndex, startLine.lineIndex);

    const alreadyVisitedLocation = (location: LineLocator) => {
        return lines.some(otherLocation => (
            location.polygonIndex === otherLocation.polygonIndex &&
            location.lineIndex === otherLocation.lineIndex));
    };

    const nextLineIndex = nextIndexInPoly(polygon, startLine.lineIndex, direction);
    const nextLineLength = lineLength(map, startLine.polygonIndex, nextLineIndex);
    let visitedLine: LineLocator = {
        polygonIndex: startLine.polygonIndex,
        lineIndex: nextLineIndex,
        horizontalTexOffset: calculateTexOffset(
            startLine.horizontalTexOffset,
            direction,
            originLineLength,
            nextLineLength)
    };

    for (; ;) {
        if (alreadyVisitedLocation(visitedLine)) {
            break;
        }

        lines.push(visitedLine);

        const line = map.getPolygonLine(visitedLine.polygonIndex, visitedLine.lineIndex);
        if (line.frontPoly === -1 || line.backPoly === -1) {
            break;
        }

        const visitedPolygonIndex = map.getPortal(visitedLine.polygonIndex, visitedLine.lineIndex);
        const nextPolygon = map.getPolygon(visitedPolygonIndex);

        const polygonPointIndex = nextPolygon.endpoints.indexOf(pointIndex);
        if (polygonPointIndex === -1) {
            throw new Error('point not found in connected polygon');
        }
        const visitedPolygonSideIndex = lineIndexForPoint(nextPolygon, polygonPointIndex, direction);
        const visitedLineLength = lineLength(
            map, visitedPolygonIndex, visitedPolygonSideIndex);

        const texOffset = calculateTexOffset(
            startLine.horizontalTexOffset,
            direction,
            originLineLength,
            visitedLineLength);

        visitedLine = {
            polygonIndex: visitedPolygonIndex,
            lineIndex: visitedPolygonSideIndex,
            horizontalTexOffset: texOffset
        };
    }

    return lines;
}

function directlyConnectedLineSurfacesInDirection(
    map: MapGeometry,
    texturedSurface: TexturedSurface<WallSurface>,
    direction: Direction,
): TexturedSurface<WallSurface>[] {
    const startLine: LineLocator = {
        polygonIndex: texturedSurface.surface.polygonIndex,
        lineIndex: texturedSurface.surface.wallIndex,
        horizontalTexOffset: texturedSurface.texOffset[0]
    };
    const lines = getConnectingLines(map, startLine, direction);
    const surfaces = lines.flatMap(line => {
        const originalExtents = surfaceExtents(map, texturedSurface.surface);
        return lineSolidSurfaces(map, line).map(surface => {
            const connectedExtents = surfaceExtents(map, surface);
            const verticalOffset = originalExtents.top - connectedExtents.top;
            return {
                surface,
                texOffset: v2(line.horizontalTexOffset, texturedSurface.texOffset[1] + verticalOffset)
            };
        });
    });
    return surfaces.filter(otherSurface => extentsOverlap(
        surfaceExtents(map, texturedSurface.surface),
        surfaceExtents(map, otherSurface.surface)));
}

function directlyConnectedLineSurfaces(
    map: MapGeometry,
    surface: TexturedSurface<WallSurface>,
    extraCriteria?: SurfacePredicate
): TexturedSurface<WallSurface>[] {
    const surfaces = [
        ...directlyConnectedLineSurfacesInDirection(
            map, surface, 'counterclockwise'),
        ...directlyConnectedLineSurfacesInDirection(
            map, surface, 'clockwise'),
    ];
    return extraCriteria ? surfaces.filter(s => extraCriteria(s.surface)) : surfaces;
}

// vertical surface is connected to another if
// 1. the vertical ranges of the top / bottom of the surfaces overlap
// 2. they lie on connected lines
function getConnectedVerticalSurfaces(
    map: MapGeometry,
    surface: WallSurface,
    extraCriteria?: SurfacePredicate
): TexturedSurface[] {
    const surfaces: TexturedSurface<WallSurface>[] = [{
        texOffset: v2(0, 0),
        surface
    }];
    let frontier: TexturedSurface<WallSurface>[] = [...surfaces];

    do {
        const direct = frontier.flatMap(frontierSurface => {
            return directlyConnectedLineSurfaces(
                map,
                frontierSurface,
                extraCriteria);
        });

        const newFrontier: TexturedSurface<WallSurface>[] = [];

        for (const surface of direct) {
            const alreadyVisited = surfaces.some(alreadyVisitedSurface =>
                surfacesEqual(surface.surface, alreadyVisitedSurface.surface));

            if (!alreadyVisited) {
                surfaces.push(surface);
                newFrontier.push(surface);
            }
        }

        frontier = newFrontier;
    } while (frontier.length > 0);

    return surfaces;
}

export function getConnectedSurfaces(
    map: MapGeometry,
    surface: Surface,
    extraCriteria?: SurfacePredicate
): TexturedSurface[] {
    switch (surface.type) {
        case 'floor':
        case 'ceiling':
            return getConnectedHorizontalSurfaces(map, surface, extraCriteria);
        case 'wallPrimary':
        case 'wallSecondary':
        case 'wallTransparent':
            return getConnectedVerticalSurfaces(map, surface, extraCriteria);
        default:
            impossibleValue(surface);
    }
}

