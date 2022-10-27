import { EditorState } from '.';
import { Vec2 } from '../../vector2';

interface ExistingStartPoint {
    type: 'existing';
    pointIndex: number;
}

interface NewStartPoint {
    type: 'new';
    position: Vec2;
}

export type StartPoint = ExistingStartPoint | NewStartPoint;

export interface DrawOperation {
    startPoint: StartPoint;
    endPoint: Vec2;
}

export function setDrawOperation(
    state: EditorState, op: DrawOperation
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

