import { JSXInternal } from 'preact/src/jsx';
import { MapGeometry } from '../../files/map';
import { Shapes } from '../../shapes-loader';
import { Action, EditMode, EditorState, getSelection } from '../state';
import { SnapGridSize } from '../state/snapGrid';
import { VisualMode } from '../VisualMode';
import { MapView } from './MapView';
import { SnapSelector } from './SnapSelector';

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
        case 'floor_height':
        case 'ceiling_height':
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
            <option value="floor_height">Floor Height</option>
            <option value="ceiling_height">Ceiling Height</option>
            <option value="visual">Visual</option>
        </select >
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

    function changeSnapGrid(size: SnapGridSize) {
        updateState({ type: 'setSnapSize', size });
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
                    <SnapSelector value={state.snapGridSize} onChange={changeSnapGrid} />
                </div>
                {state.map && (
                    <MapSummary map={state.map} />
                )}
            </div>
            {(state.mode.type === 'geometry' ||
                state.mode.type === 'floor_height' ||
                state.mode.type === 'ceiling_height') && (
                    <MapView
                        state={state}
                        updateState={updateState}
                        mode={state.mode}
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
