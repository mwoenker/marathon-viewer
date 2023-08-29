import { MapGeometry } from '../../files/map';
import { closestLine, closestObject, closestPoint, polygonsAt } from '../../geometry';
import { v2dist, v2sub, v3tov2, Vec2 } from "../../vector2";

interface ClickedObject {
    type: 'object' | 'point' | 'line' | 'polygon';
    index: number;
    position: Vec2;
}

export function findClickedObject(
    map: MapGeometry,
    mapCoords: Vec2,
    pixelSize: number
): ClickedObject | null {
    const distThreshold = pixelSize * 4;
    const objectLogicalSize = pixelSize * 4;

    // Did we click on a point?
    const pointIndex = closestPoint(mapCoords, map);
    const position = map.points[pointIndex];
    if (pointIndex >= 0 && v2dist(position, mapCoords) < distThreshold) {
        return {
            type: 'point',
            index: pointIndex,
            position
        };
    }

    // Did we click on an object?
    const objectIndex = closestObject(mapCoords, map);
    if (objectIndex >= 0) {
        const objectPosition = v3tov2(map.objects[objectIndex].position);
        if (v2dist(objectPosition, mapCoords) - objectLogicalSize < distThreshold) {
            return {
                type: 'object',
                index: objectIndex,
                position: objectPosition
            };
        }
    }


    // Did we click on a line?
    const closest = closestLine(mapCoords, map);
    if (closest && closest.distance < distThreshold) {
        const linePos = map.points[map.lines[closest.index].begin];
        return {
            type: 'line',
            index: closest.index,
            position: linePos
        };
    }

    // Did we click on a polygon?
    const polygons = polygonsAt(mapCoords, map);
    if (polygons.length > 0) {
        const idx = polygons[polygons.length - 1];
        const poly = map.polygons[idx];
        // polygon "position" is position of first endpoint
        const polyPos = map.points[poly.endpoints[0]];
        return {
            type: 'polygon',
            index: idx,
            position: polyPos
        };
    }

    return null;
}
