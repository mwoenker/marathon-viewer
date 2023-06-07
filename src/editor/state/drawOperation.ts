import { EditorState } from '.';
import { MapGeometry } from '../../files/map';
import { Vec2 } from '../../vector2';
import { findClickedObject } from '../RightPanel/click';
import { addLine, getOrAddPoint, setMap } from './setMap';

export interface DrawOperation {
    startPointIndex: number;
    endPoint: Vec2;
}

function setDrawOperation(
    state: EditorState, op: DrawOperation | undefined
): EditorState {
    if (state.mode.type !== 'geometry' ||
        state.mode.toolState.tool !== 'draw') {
        console.warn('setDrawOperation called in incorrect state');
        return state;
    } else {
        return {
            ...state,
            mode: {
                ...state.mode,
                toolState: {
                    ...state.mode.toolState,
                    drawOperation: op
                }
            }
        };
    }
}

export function getDrawOperation(state: EditorState): DrawOperation | undefined {
    if (state.mode.type !== 'geometry' ||
        state.mode.toolState.tool !== 'draw') {
        return undefined;
    } else {
        return state.mode.toolState.drawOperation;
    }
}

export function startDrawOperationFromPoint(
    state: EditorState,
    position: Vec2,
): EditorState {
    const [stateWithPoint, pointIndex] = getOrAddPoint(state, position, true);

    return setDrawOperation(stateWithPoint, {
        startPointIndex: pointIndex,
        endPoint: position,
    });
}

export function continueDrawOperation(
    state: EditorState,
    endPoint: Vec2,
): EditorState {
    const oldOperation = getDrawOperation(state);
    if (!oldOperation) {
        return state;
        //throw new Error('continueDrawOperation called with no draw operation in progress');
    }
    return setDrawOperation(state, {
        startPointIndex: oldOperation.startPointIndex,
        endPoint,
    });
}

export function finishDrawOperation(
    state: EditorState,
): EditorState {
    const operation = getDrawOperation(state);
    if (!operation) {
        return state;
    }
    const [stateWithPoint, endPointIndex] = getOrAddPoint(state, operation.endPoint, true);
    const [stateWithLine] = addLine(stateWithPoint, operation.startPointIndex, endPointIndex);
    return setDrawOperation(stateWithLine, undefined);
}
