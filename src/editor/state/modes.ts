import { DrawOperation } from './drawOperation';
import { Selection } from './selection';
import { EditorState } from '.';

export interface DrawToolState {
    tool: 'draw';
    drawOperation?: DrawOperation | undefined;
}

export interface SelectToolState {
    tool: 'select';
    selection?: Selection
}

export type ToolState = SelectToolState | DrawToolState;
export type ToolName = ToolState['tool']

export interface GeometryModeState {
    type: 'geometry'
    toolState: ToolState
}

export interface VisualModeState {
    type: 'visual'
    selectedTexture?: number | undefined
}

export type ModeState = GeometryModeState | VisualModeState

export type EditMode = ModeState['type']

export function toolSelected(state: EditorState, type: ToolName): boolean {
    return state.mode.type === 'geometry' && state.mode.toolState.tool === type;
}
