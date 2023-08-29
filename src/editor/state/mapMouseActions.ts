import { EditorState, setSelection, getSelection } from '.';
import { MapGeometry } from '../../files/map';
import { findPolygonToFill } from '../../files/map/fillPolygon';
import { MapObject } from '../../files/map/object';
import { polygonsAt } from '../../geometry';
import { v2sub } from '../../vector2';
import { findClickedObject } from '../RightPanel/click';
import { MouseDownAction, MouseMoveAction, MouseUpAction } from './actions';
import { continueDrawOperation, finishDrawOperation, startDrawOperationFromPoint } from './drawOperation';
import { toolSelected } from './modes';
import { blankSelection, Selection } from './selection';
import { setMap } from './setMap';

function dragDist(state: Selection) {
    if (!state.startCoords || !state.currentCoords) {
        return 0;
    } else {
        const dx = state.startCoords[0] - state.currentCoords[0];
        const dy = state.startCoords[1] - state.currentCoords[1];
        return Math.sqrt((dx * dx) + (dy * dy));
    }
}

function dragMapObject(
    state: EditorState,
    selection: Selection,
    map: MapGeometry
): EditorState {
    if (!state.map || !selection.currentCoords) {
        return state;
    } else if (selection.objType === 'point') {
        return setMap(
            state,
            state.map.movePoint(
                selection.index,
                [
                    Math.floor(selection.currentCoords[0]),
                    Math.floor(selection.currentCoords[1]),
                ],
            ),
            true
        );
    } else if (selection.objType === 'polygon') {
        return setMap(state, map.movePolygon(
            selection.index,
            v2sub(
                selection.currentCoords,
                selection.relativePos)), true);

    } else if (selection.objType === 'object') {
        return setMap(state, map.moveObject(
            selection.index,
            v2sub(
                selection.currentCoords,
                selection.relativePos)), true);

    } else {
        return state;
    }
}

export function mouseDown(state: EditorState, action: MouseDownAction): EditorState {
    if (!state.map) {
        return state;
    }

    const { map } = state;

    if (toolSelected(state, 'select')) {
        const clickedObject = findClickedObject(
            map, action.coords, state.pixelSize);
        if (!clickedObject) {
            return setSelection(state, blankSelection);
        } else {
            return setSelection(state, {
                ...blankSelection,
                objType: clickedObject.type,
                index: clickedObject.index,
                relativePos: v2sub(action.coords, clickedObject.position),
                isMouseDown: true,
                startCoords: action.coords,
                currentCoords: action.coords,
            });
        }
    } else if (toolSelected(state, 'draw')) {
        return startDrawOperationFromPoint(state, action.coords);
    } else if (toolSelected(state, 'fill')) {
        const newPolygon = findPolygonToFill(action.coords, state.map);
        if (!newPolygon) {
            return state;
        } else {
            return setMap(state, map.addPolygon(newPolygon));
        }
    } else if (toolSelected(state, 'object')) {
        const polygonIndexes = polygonsAt(action.coords, map);
        if (polygonIndexes.length === 0) {
            return state;
        }
        const polygonIndex = polygonIndexes[0];
        const polygon = state.map.getPolygon(polygonIndex);
        const newMap = map.addObject(polygonIndexes[0], [...action.coords, polygon.floorHeight]);
        const withMap = setMap(state, newMap);
        return setSelection(withMap, {
            objType: 'object',
            index: newMap.objects.length - 1,
            relativePos: [0, 0],
            isMouseDown: false,
            isDragging: false,
            startCoords: action.coords,
            currentCoords: action.coords,
        });

    } else if (state.mode.type === 'floor_height' &&
        typeof state.mode.selectedHeight === 'number') {
        const polygonIndexes = polygonsAt(action.coords, map);
        if (polygonIndexes.length === 0) {
            return state;
        }
        const polygonIndex = polygonIndexes[polygonIndexes.length - 1];
        const newMap = map.setFloorHeight(polygonIndex, state.mode.selectedHeight);
        return setMap(state, newMap);
    } else if (state.mode.type === 'ceiling_height' &&
        typeof state.mode.selectedHeight === 'number') {
        const polygonIndexes = polygonsAt(action.coords, map);
        if (polygonIndexes.length === 0) {
            return state;
        }
        const polygonIndex = polygonIndexes[polygonIndexes.length - 1];
        return setMap(state, map.setCeilingHeight(polygonIndex, state.mode.selectedHeight));
    } else {
        return state;
    }
}

export function mouseMove(state: EditorState, action: MouseMoveAction): EditorState {
    const selection = getSelection(state);

    if (toolSelected(state, 'select')) {
        if (!selection.isMouseDown) {
            return state;
        }
        const newSelection = { ...selection, currentCoords: action.coords };
        if (dragDist(newSelection) >= 8 * action.pixelSize) {
            newSelection.isDragging = true;
        }
        if (!newSelection.isDragging || !state.map) {
            return setSelection(state, newSelection);
        } else {
            return dragMapObject(state, newSelection, state.map);
        }
    } else if (toolSelected(state, 'draw')) {
        return continueDrawOperation(state, action.coords);
    } else {
        return state;
    }
}

export function mouseUp(state: EditorState, action: MouseUpAction): EditorState {
    if (state.map && toolSelected(state, 'select')) {
        // Not dragging any more
        return setMap(
            setSelection(state, {
                ...getSelection(state),
                isMouseDown: false,
                isDragging: false,
                currentCoords: null,
            }),
            state.map,
            false
        );
    } else if (toolSelected(state, 'draw')) {
        if (state.map) {
            return finishDrawOperation(state);
        } else {
            return state;
        }
    } else {
        return state;
    }
}
