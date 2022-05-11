import { JSXInternal } from 'preact/src/jsx';
import { MapGeometry } from '../../files/map';
import { Shapes } from '../../shapes-loader';
import { Action, EditMode, EditorState } from '../state';
import { VisualMode } from '../VisualMode';
import { MapView } from './MapView';

function MapSummary({ map }: { map: MapGeometry }) {
    if (map && map.polygons && map.lines && map.points) {
        return (
            <div className="mapSummary">
                {`Level: ${map.info.name} - ` +
                    `${map.polygons.length} polygons, ` +
                    `${map.lines.length} lines, ` +
                    `${map.points.length} points`}
            </div>
        );
    } else {
        return <></>;
    }
}

interface RightPanelProps {
    state: EditorState
    updateState: (action: Action) => void
    shapes: Shapes
}

interface ModeSelectorProps {
    value: EditMode
    onChange: (newMode: EditMode) => void
}

function parseEditMode(modeStr: string): EditMode {
    switch (modeStr) {
        case 'geometry':
        case 'visual':
            return modeStr;
        default:
            throw new Error(`Unknown edit mode: ${modeStr}`);
    }
}

function ModeSelector({ value, onChange }: ModeSelectorProps) {
    const change = (e: JSXInternal.TargetedEvent<HTMLSelectElement>) => {
        onChange(parseEditMode(e.currentTarget.value));
    };

    return (
        <select value={value} onChange={change}>
            <option value="geometry">Geometry</option>
            <option value="visual">Visual</option>
        </select>
    );
}

export function RightPanel({
    state,
    updateState,
    shapes
}: RightPanelProps): JSX.Element {
    function keyDown(e: KeyboardEvent) {
        switch (e.key) {
            case '+':
            case '=':
                e.preventDefault();
                updateState({ type: 'zoomIn' });
                break;
            case '_':
            case '-':
                e.preventDefault();
                updateState({ type: 'zoomOut' });
                break;
        }
    }

    function changeMode(editMode: EditMode) {
        updateState({ type: 'setEditMode', editMode });
    }

    return (
        <div className="rightPanel"
            tabIndex={0}
            onKeyDown={keyDown} >
            <div className="topBar">
                <div className="zoomIcons">
                    <button onClick={() => updateState({ type: 'zoomOut' })}>
                        -
                    </button>
                    <button onClick={() => updateState({ type: 'zoomIn' })}>
                        +
                    </button>
                    <ModeSelector value={state.mode.type} onChange={changeMode} />
                </div>
                {state.map && (
                    <MapSummary map={state.map} />
                )}
            </div>
            {state.mode.type === 'geometry' && (
                <MapView
                    map={state.map}
                    pixelSize={state.pixelSize}
                    selection={state.selection}
                    updateState={updateState}
                />
            )}

            {state.mode.type === 'visual' && state.map && (
                <VisualMode
                    map={state.map}
                    shapes={shapes}
                    visualModeState={state.mode}
                    updateState={updateState}
                />
            )}
        </div>
    );
}
