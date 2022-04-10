import { JSXInternal } from 'preact/src/jsx';
import { useState } from 'react';
import { MapGeometry } from '../../files/map';
import { MouseAction, Selection } from '../selection';
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
    pixelSize: number
    map: MapGeometry | undefined
    onMapChange(map: MapGeometry): void
    onZoomIn(): void
    onZoomOut(): void,
    selection: Selection,
    updateSelection: (action: MouseAction) => void
}

export type EditMode =
    'geometry' |
    'visual';

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
    pixelSize,
    map,
    onMapChange,
    onZoomIn,
    onZoomOut,
    selection,
    updateSelection
}: RightPanelProps): JSX.Element {
    const [mode, setMode] = useState<EditMode>('geometry');

    function keyDown(e: KeyboardEvent) {
        switch (e.key) {
            case '+':
            case '=':
                e.preventDefault();
                onZoomIn();
                break;
            case '_':
            case '-':
                e.preventDefault();
                onZoomOut();
                break;
        }
    }

    function changeMode(mode: EditMode) {
        setMode(mode);
    }

    return (
        <div className="rightPanel"
            tabIndex={0}
            onKeyDown={keyDown} >
            <div className="topBar">
                <div className="zoomIcons">
                    <button onClick={onZoomOut}>
                        -
                    </button>
                    <button onClick={onZoomIn}>
                        +
                    </button>
                    <ModeSelector value={mode} onChange={changeMode} />
                </div>
                {map && (
                    <MapSummary map={map} />
                )}
            </div>
            {mode === 'geometry' && (
                <MapView
                    map={map}
                    onMapChange={onMapChange}
                    pixelSize={pixelSize}
                    selection={selection}
                    updateSelection={updateSelection}
                />
            )}

            {mode === 'visual' && map && (
                <VisualMode map={map} />
            )}
        </div>
    );
}
