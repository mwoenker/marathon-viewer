import { Vec2 } from '../../vector2';

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

export const blankSelection: Selection = {
    objType: null,
    index: -1,
    relativePos: [0, 0], // Position of initial mousedown relative to object
    isMouseDown: false,
    isDragging: false,
    startCoords: [0, 0],
    currentCoords: [0, 0],
};

