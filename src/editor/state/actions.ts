import { EditMode, ToolState } from ".";
import { MapGeometry } from "../../files/map";
import { Vec2 } from "../../vector2";
import { SelectionObjectType } from "./selection";
import { SnapGridSize } from "./snapGrid";

export interface MouseDownAction {
    type: 'mapMouseDown',
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

export type MouseAction =
    MouseDownAction | MouseUpAction | MouseMoveAction | MouseCancelAction | SelectObjectAction

export interface ZoomInAction { type: 'zoomIn' }
export interface ZoomOutAction { type: 'zoomOut' }
export interface SetSnapSizeAction { type: 'setSnapSize', size: SnapGridSize }
export interface SetMapAction { type: 'setMap', map: MapGeometry, isEphemeral?: boolean }
export interface LoadNewMapAction { type: 'loadNewMap', map: MapGeometry, isEphemeral?: boolean }
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

export interface SelectLightAction {
    type: 'selectLight';
    light: number | undefined;
}

export interface SelectToolAction {
    type: 'selectTool';
    tool: ToolState['tool'];
}

export interface SelectHeightAction {
    type: 'selectHeight';
    height: number | undefined;
}

export interface NewHeightAction {
    type: 'addNewHeight';
    height: number;
}

export interface SetNewHeigtsAction {
    type: 'setNewHeights';
    heights: ReadonlySet<number>;
}

export interface ChangeHeightAction {
    type: 'changeHeight';
    oldHeight: number;
    newHeight: number;
}

export type Action =
    MouseAction |
    ZoomInAction |
    ZoomOutAction |
    SetSnapSizeAction |
    SetMapAction |
    LoadNewMapAction |
    SetEditMode |
    UndoAction |
    RedoAction |
    SelectTextureAction |
    SelectLightAction |
    SelectToolAction |
    SelectHeightAction |
    NewHeightAction |
    SetNewHeigtsAction |
    ChangeHeightAction;

