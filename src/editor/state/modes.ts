import { DrawOperation } from './drawOperation';
import { Selection } from './selection';
import { EditorState } from '.';

export interface DrawToolState {
    tool: 'draw';
    drawOperation?: DrawOperation | undefined;
}

export interface FillToolState {
    tool: 'fill';
}

export interface SelectToolState {
    tool: 'select';
    selection?: Selection
}

export type ToolState = SelectToolState | DrawToolState | FillToolState;
export type ToolName = ToolState['tool']

export interface GeometryModeState {
    type: 'geometry'
    toolState: ToolState
}

export interface VisualModeState {
    type: 'visual'
    selectedTexture?: number | undefined
    selectedLight?: number | undefined
}

export interface HeightModeState {
    type: 'floor_height' | 'ceiling_height';
    selectedHeight?: number;
    newHeights: ReadonlySet<number>;
}

export type ModeState = GeometryModeState | VisualModeState | HeightModeState;

export type EditMode = ModeState['type']

export function toolSelected(state: EditorState, type: ToolName): boolean {
    return state.mode.type === 'geometry' && state.mode.toolState.tool === type;
}
