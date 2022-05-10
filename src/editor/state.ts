import { Dispatch, useReducer } from 'react';
import { Vec2 } from '../vector2';
import { MapGeometry } from '../files/map';

export type SelectionObjectType = 'point' | 'line' | 'polygon' | 'object';

export type EditMode =
    'geometry' |
    'visual';

export interface GeometryModeState {
    type: 'geometry'
}

export interface VisualModeState {
    type: 'visual'
    selectedTexture?: number | undefined
}

export type ModeState = GeometryModeState | VisualModeState

export interface Selection {
    objType: SelectionObjectType | null,
    index: number,
    relativePos: Vec2,
    isMouseDown: boolean,
    isDragging: boolean,
    startCoords: Vec2,
    currentCoords: null | Vec2,
}

const blankSelection: Selection = {
    objType: null,
    index: -1,
    relativePos: [0, 0], // Position of initial mousedown relative to object
    isMouseDown: false,
    isDragging: false,
    startCoords: [0, 0],
    currentCoords: [0, 0],
};

const initialState: EditorState = {
    selection: blankSelection,
    pixelSize: 64,
    map: undefined,
    mode: {
        type: 'geometry'
    }
};

export interface MouseDownAction {
    type: 'down',
    objType: SelectionObjectType,
    index: number,
    relativePos: Vec2,
    coords: Vec2,
}

export interface MouseUpAction {
    type: 'up',
}

export interface MouseMoveAction {
    type: 'move',
    coords: Vec2,
    pixelSize: number,
}

export interface MouseCancelAction {
    type: 'cancel'
}

export interface SelectObjectAction {
    type: 'selectObject',
    objType: SelectionObjectType | null,
    index: number
}

export interface EditorState {
    selection: Selection
    map: MapGeometry | undefined
    pixelSize: number
    mode: ModeState
}

export type MouseAction =
    MouseDownAction | MouseUpAction | MouseMoveAction | MouseCancelAction | SelectObjectAction

export interface ZoomInAction { type: 'zoomIn' }
export interface ZoomOutAction { type: 'zoomOut' }
export interface SetMapAction { type: 'setMap', map: MapGeometry }
export interface SetEditMode {
    type: 'setEditMode',
    editMode: EditMode
}

export interface SelectTextureAction {
    type: 'selectTexture',
    texture: number | undefined
}

export type Action =
    MouseAction |
    ZoomInAction |
    ZoomOutAction |
    SetMapAction |
    SetEditMode |
    SelectTextureAction;

const zoomIncrement = 1.5;

export type UpdateState = (action: Action) => void

function dragDist(state: Selection) {
    if (!state.startCoords || !state.currentCoords) {
        return 0;
    } else {
        const dx = state.startCoords[0] - state.currentCoords[0];
        const dy = state.startCoords[1] - state.currentCoords[1];
        return Math.sqrt((dx * dx) + (dy * dy));
    }
}

function setSelection(state: EditorState, selection: Selection) {
    if (selection === state.selection) {
        return state;
    } else {
        return { ...state, selection };
    }
}

function reduce(state: EditorState, action: Action): EditorState {
    switch (action.type) {
        case 'down':
            return setSelection(state, {
                ...blankSelection,
                objType: action.objType,
                index: action.index,
                relativePos: action.relativePos,
                isMouseDown: true,
                startCoords: action.coords,
                currentCoords: action.coords,
            });
        case 'up':
            // Not dragging any more
            return setSelection(state, {
                ...state.selection,
                isMouseDown: false,
                isDragging: false,
                currentCoords: null,
            });
        case 'selectObject':
            return setSelection(state, {
                objType: action.objType,
                index: action.index,
                relativePos: [0, 0],
                isMouseDown: false,
                isDragging: false,
                currentCoords: null,
                startCoords: [0, 0],
            });
        case 'move': {
            if (!state.selection.isMouseDown) {
                return state;
            }
            const newSelection = { ...state.selection, currentCoords: action.coords };
            if (dragDist(newSelection) >= 8 * action.pixelSize) {
                newSelection.isDragging = true;
            }
            return setSelection(state, newSelection);
        }
        case 'cancel':
            return setSelection(state, blankSelection);
        case 'zoomIn':
            return {
                ...state,
                pixelSize: state.pixelSize / zoomIncrement
            };
        case 'zoomOut':
            return {
                ...state,
                pixelSize: state.pixelSize * zoomIncrement
            };
        case 'setMap':
            return { ...state, map: action.map };
        case 'setEditMode':
            return {
                ...state,
                mode: {
                    type: action.editMode
                }
            };
        case 'selectTexture':
            if (state.mode.type !== 'visual') {
                return state;
            } else {
                return {
                    ...state,
                    mode: {
                        ...state.mode,
                        selectedTexture: action.texture
                    }
                };
            }
        default:
            throw new Error(`invalid action`);
    }
}

type EditorStateResult = [EditorState, Dispatch<Action>];

export function useEditorState(): EditorStateResult {
    return useReducer(reduce, initialState);
}
