import { EditorState } from ".";
import { MapGeometry } from "../../files/map";

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
