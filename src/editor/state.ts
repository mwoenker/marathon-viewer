import { Dispatch, useReducer } from 'react';
import { Vec2 } from '../vector2';
import { MapGeometry } from '../files/map';
import { impossibleValue } from '../utils';

export type SelectionObjectType = 'point' | 'line' | 'polygon' | 'object';

export type EditMode =
    'geometry' |
    'visual';

export interface SelectToolState {
    tool: 'select';
    selection?: Selection
}

export interface DrawToolState {
    tool: 'draw';
}

export type ToolState = SelectToolState | DrawToolState;

export interface GeometryModeState {
    type: 'geometry'
    toolState: ToolState
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
    pixelSize: 64,
    map: undefined,
    isEphemeral: false,
    undoStack: [],
    redoStack: [],
    mode: {
        type: 'geometry',
        toolState: {
            tool: 'select',
            selection: blankSelection
        }
    }
};

export interface MouseDownAction {
    type: 'mapMouseDown',
    objType: SelectionObjectType,
    index: number,
    relativePos: Vec2,
    coords: Vec2,
}

export interface MouseUpAction {
    type: 'mapMouseUp',
}

export interface MouseMoveAction {
    type: 'mapMouseMove',
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
    map: MapGeometry | undefined
    isEphemeral: boolean // current state is ephemeral, next setMap should replace not push onto undo
    pixelSize: number
    mode: ModeState
    undoStack: MapGeometry[]
    redoStack: MapGeometry[]
}

export type MouseAction =
    MouseDownAction | MouseUpAction | MouseMoveAction | MouseCancelAction | SelectObjectAction

export interface ZoomInAction { type: 'zoomIn' }
export interface ZoomOutAction { type: 'zoomOut' }
export interface SetMapAction { type: 'setMap', map: MapGeometry, isEphemeral?: boolean }
export interface UndoAction { type: 'undo' }
export interface RedoAction { type: 'redo' }
export interface SetEditMode {
    type: 'setEditMode',
    editMode: EditMode
}

export interface SelectTextureAction {
    type: 'selectTexture',
    texture: number | undefined
}

export interface SelectToolAction {
    type: 'selectTool';
    tool: ToolState['tool'];
}

export type Action =
    MouseAction |
    ZoomInAction |
    ZoomOutAction |
    SetMapAction |
    SetEditMode |
    UndoAction |
    RedoAction |
    SelectTextureAction |
    SelectToolAction;

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

function setSelection(state: EditorState, selection: Selection): EditorState {
    if (selection === getSelection(state) ||
        state.mode.type !== 'geometry' ||
        state.mode.toolState.tool !== 'select') {
        return state;
    } else {
        return {
            ...state,
            mode: {
                ...state.mode,
                toolState: {
                    ...state.mode.toolState,
                    selection
                }
            }
        };
    }
}

function defaultModeState(mode: EditMode): ModeState {
    switch (mode) {
        case 'geometry':
            return initialState.mode;
        case 'visual':
            return { type: 'visual' };
        default:
            impossibleValue(mode);
    }
}

function reduce(state: EditorState, action: Action): EditorState {
    switch (action.type) {
        case 'mapMouseDown':
            return setSelection(state, {
                ...blankSelection,
                objType: action.objType,
                index: action.index,
                relativePos: action.relativePos,
                isMouseDown: true,
                startCoords: action.coords,
                currentCoords: action.coords,
            });
        case 'mapMouseUp':
            // Not dragging any more
            return setSelection(state, {
                ...getSelection(state),
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
        case 'mapMouseMove': {
            const selection = getSelection(state);
            if (!selection.isMouseDown) {
                return state;
            }
            const newSelection = { ...selection, currentCoords: action.coords };
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
        case 'setMap': {
            let undo: MapGeometry[];
            if (!state.map) {
                undo = [];
            } else if (state.isEphemeral) {
                undo = state.undoStack;
            } else {
                undo = [...state.undoStack, state.map];
            }
            return {
                ...state,
                isEphemeral: action.isEphemeral === true,
                map: action.map,
                undoStack: undo,
                redoStack: []
            };
        }
        case 'undo':
            if (state.undoStack.length === 0) {
                return state;
            } else {
                if (!state.map) {
                    throw new Error('current state undefined with non-empty undo stack');
                }
                return {
                    ...state,
                    undoStack: state.undoStack.slice(0, state.undoStack.length - 1),
                    map: state.undoStack[state.undoStack.length - 1],
                    redoStack: [...state.redoStack, state.map],
                };
            }
        case 'redo':
            if (state.redoStack.length === 0) {
                return state;
            } else {
                if (!state.map) {
                    throw new Error('current state undefined with non-empty redo stack');
                }
                return {
                    ...state,
                    undoStack: [...state.undoStack, state.map],
                    map: state.redoStack[state.redoStack.length - 1],
                    redoStack: state.redoStack.slice(0, state.redoStack.length - 1)
                };
            }
        case 'setEditMode':
            return {
                ...state,
                mode: defaultModeState(action.editMode)
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
        case 'selectTool':
            if (state.mode.type !== 'geometry') {
                return state;
            } else {
                return {
                    ...state,
                    mode: {
                        ...state.mode,
                        toolState: { tool: action.tool }
                    }
                };
            }
        default:
            throw new Error(`invalid action`);
    }
}

type EditorStateResult = [EditorState, Dispatch<Action>];

export function getSelection(state: EditorState): Selection {
    if (state.mode.type === 'geometry' && state.mode.toolState.tool === 'select') {
        return state.mode.toolState.selection ?? blankSelection;
    } else {
        return blankSelection;
    }
}

export function useEditorState(): EditorStateResult {
    return useReducer(reduce, initialState);
}
