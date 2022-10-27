import { Dispatch, useReducer } from 'react';
import { MapGeometry } from '../../files/map';
import { impossibleValue } from '../../utils';
import { Action } from './actions';
import { mouseDown, mouseMove, mouseUp } from './mapMouseActions';
import { EditMode, ModeState, VisualModeState, ToolState } from './modes';
import { blankSelection, Selection } from './selection';
import { setMap } from './setMap';

export {
    Action,
    Selection,
    EditMode,
    ModeState,
    VisualModeState,
    ToolState
};

export interface EditorState {
    map: MapGeometry | undefined
    isEphemeral: boolean // current state is ephemeral, next setMap should replace not push onto undo
    pixelSize: number
    mode: ModeState
    undoStack: MapGeometry[]
    redoStack: MapGeometry[]
}

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

const zoomIncrement = 1.5;

export type UpdateState = (action: Action) => void

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
            return mouseDown(state, action);
        case 'mapMouseUp':
            return mouseUp(state, action);
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
        case 'mapMouseMove':
            return mouseMove(state, action);
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
            return setMap(state, action.map, Boolean(action.isEphemeral));
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

export function setSelection(state: EditorState, selection: Selection): EditorState {
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

export function useEditorState(): EditorStateResult {
    return useReducer(reduce, initialState);
}
