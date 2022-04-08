import { Dispatch, useReducer } from 'react';
import { Vec2 } from '../vector2';

export type SelectionObjectType = 'point' | 'line' | 'polygon' | 'object';

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

export type MouseAction =
    MouseDownAction | MouseUpAction | MouseMoveAction | MouseCancelAction | SelectObjectAction

function dragDist(state: Selection) {
    if (!state.startCoords || !state.currentCoords) {
        return 0;
    } else {
        const dx = state.startCoords[0] - state.currentCoords[0];
        const dy = state.startCoords[1] - state.currentCoords[1];
        return Math.sqrt((dx * dx) + (dy * dy));
    }
}

function reduceSelection(state: Selection, action: MouseAction): Selection {
    switch (action.type) {
        case 'down':
            return {
                ...blankSelection,
                objType: action.objType,
                index: action.index,
                relativePos: action.relativePos,
                isMouseDown: true,
                startCoords: action.coords,
                currentCoords: action.coords,
            };
        case 'up':
            // Not dragging any more
            return {
                ...state,
                isMouseDown: false,
                isDragging: false,
                currentCoords: null,
            };
        case 'selectObject':
            return {
                objType: action.objType,
                index: action.index,
                relativePos: [0, 0],
                isMouseDown: false,
                isDragging: false,
                currentCoords: null,
                startCoords: [0, 0],
            };
        case 'move': {
            if (!state.isMouseDown) {
                return state;
            }
            const newState = { ...state, currentCoords: action.coords };
            if (dragDist(newState) >= 8 * action.pixelSize) {
                newState.isDragging = true;
            }
            return newState;
        }
        case 'cancel':
            return blankSelection;
        default:
            throw new Error(`invalid selection action`);
    }
}

type SelectionState = [Selection, Dispatch<MouseAction>];

export function useSelectionState(): SelectionState {
    return useReducer(reduceSelection, blankSelection);
}
