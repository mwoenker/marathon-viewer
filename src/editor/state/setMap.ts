import { EditorState } from ".";
import { MapGeometry } from "../../files/map";
import { Vec2 } from "../../vector2";
import { findClickedObject } from "../RightPanel/click";

export function setMap(
    state: EditorState,
    map: MapGeometry,
    isEphemeral = false
): EditorState {
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
        isEphemeral: isEphemeral === true,
        map: map,
        undoStack: undo,
        redoStack: []
    };
}

export function addPoint(
    state: EditorState,
    point: Vec2,
    isEphemeral = false
): [EditorState, number] {
    if (!state.map) {
        throw new Error("Can't modify nonexistent map");
    }
    const [mapWithPoint, newPointIndex] = state.map.addPoint(point);
    const pointIndex = newPointIndex;
    return [
        setMap(state, mapWithPoint, isEphemeral),
        pointIndex
    ];
}

export function getOrAddPoint(
    state: EditorState,
    point: Vec2,
    isEphemeral = false
): [EditorState, number] {
    if (!state.map) {
        throw new Error("Can't modify nonexistent map");
    }
    const clickedObject = findClickedObject(
        state.map,
        point,
        state.pixelSize
    );
    if (clickedObject?.type === 'point') {
        return [state, clickedObject.index];
    } else {
        return addPoint(state, point, isEphemeral);
    }
}

export function addLine(
    state: EditorState,
    startPointIndex: number,
    endPointIndex: number,
    isEphemeral = false
): [EditorState, number] {
    if (!state.map) {
        throw new Error("Can't modify nonexistent map");
    }
    const [mapWithPoint, newLineIndex] = state.map.addLine(startPointIndex, endPointIndex);
    const lineIndex = newLineIndex;
    return [
        setMap(state, mapWithPoint, isEphemeral),
        lineIndex
    ];
}
