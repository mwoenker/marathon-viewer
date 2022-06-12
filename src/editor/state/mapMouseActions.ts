import { EditorState, setSelection, getSelection } from '.';
import { MapGeometry } from '../../files/map';
import { v2sub } from '../../vector2';
import { MouseDownAction, MouseMoveAction, MouseUpAction } from './actions';
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
    const mode = state.mode;
    if (mode.type === 'geometry' && mode.toolState.tool === 'select') {
        return setSelection(state, {
            ...blankSelection,
            objType: action.objType,
            index: action.index,
            relativePos: action.relativePos,
            isMouseDown: true,
            startCoords: action.coords,
            currentCoords: action.coords,
        });
    } else {
        return state;
    }
}

export function mouseMove(state: EditorState, action: MouseMoveAction): EditorState {
    const selection = getSelection(state);
    if (!selection.isMouseDown) {
        return state;
    }

    if (state.mode.type === 'geometry' &&
        state.mode.toolState.tool === 'select') {
        const newSelection = { ...selection, currentCoords: action.coords };
        if (dragDist(newSelection) >= 8 * action.pixelSize) {
            newSelection.isDragging = true;
        }
        if (!newSelection.isDragging || !state.map) {
            return setSelection(state, newSelection);
        } else {
            return dragMapObject(state, newSelection, state.map);
        }
    } else {
        return state;
    }
}

export function mouseUp(state: EditorState, action: MouseUpAction): EditorState {
    if (state.mode.type === 'geometry' &&
        state.mode.toolState.tool === 'select' &&
        state.map) {
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
    } else {
        return state;
    }
}
