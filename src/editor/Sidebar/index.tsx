import type { JSXInternal } from 'preact/src/jsx';
import { MapSummary, serializeWad } from '../../files/wad';
import type { MapGeometry } from '../../files/map';
import { EditorState, UpdateState } from '../state';
import { SelectionOptions } from './SelectionOptions';
import { Shapes } from '../../shapes-loader';
import { VisualOptions } from '../VisualMode/VisualOptions';

interface MapListProps {
    maps: MapSummary[],
    selectedMap: MapGeometry | undefined,
    onMapSelected(map: MapSummary): void
}

function MapList({ maps, selectedMap, onMapSelected }: MapListProps) {
    const change = (e: JSXInternal.TargetedEvent<HTMLSelectElement>) => {
        const index = parseInt(e.currentTarget.value);
        const map = maps.find((m) => m.index === index);
        if (map) {
            onMapSelected(map);
        }
    };

    return (
        <select
            class="select"
            value={selectedMap ? selectedMap.index : ''}
            onChange={change}
            disabled={maps.length === 0}
        >
            {maps.map((m) => {
                return (
                    <option key={m.index} value={m.index}>
                        {m.directoryEntry.levelName}
                    </option>
                );
            })
            }
            {maps.length === 0 && (
                <option value=''>No maps</option>
            )}
        </select >
    );
}

interface SidebarProps {
    onMapFileSelected: (file: File) => void
    onShapesFileSelected(file: File): void
    shapes: Shapes
    onMapChange(map: MapGeometry): void
    mapSummaries: MapSummary[]
    onMapSelected(map: MapSummary): void
    state: EditorState
    updateState: UpdateState
}

export function Sidebar({
    onMapFileSelected,
    onShapesFileSelected,
    mapSummaries,
    shapes,
    state,
    updateState,
    onMapChange,
    onMapSelected,
}: SidebarProps): JSX.Element {
    const fileSelected = async (e: JSXInternal.TargetedEvent<HTMLInputElement>) => {
        if (e && e.target && e.currentTarget.files && e.currentTarget.files[0]) {
            onMapFileSelected(e.currentTarget.files[0]);
        }
    };

    const shapesFileSelected = async (e: JSXInternal.TargetedEvent<HTMLInputElement>) => {
        if (e && e.target && e.currentTarget.files && e.currentTarget.files[0]) {
            onShapesFileSelected(e.currentTarget.files[0]);
        }
    };

    const save = async () => {
        if (state.map) {
            const data = serializeWad([state.map.removePrecalculatedInfo()], 'map.sceA');
            const url = URL.createObjectURL(new Blob([data]));
            const link = document.createElement('a');
            link.href = url;
            link.download = `${state.map.info.name}.sceA`;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            URL.revokeObjectURL(url);
        }
    };

    return (
        <div className="leftPanel">
            <div class="filePanel">
                <div className='controlGroup'>
                    <label for='sidebarMapFile'>Map</label>
                    <input id='sidebarMapFile' type="file" onChange={fileSelected} />
                    <label for='sidebarShapesFile'>Shapes</label>
                    <input id='sidebarShapesFile' type="file" onChange={shapesFileSelected} />
                </div>
                <MapList
                    maps={mapSummaries}
                    selectedMap={state.map}
                    onMapSelected={onMapSelected} />
                <div className='buttonRow'>
                    <button className='sidebarSaveButton' onClick={save}>Save Map</button>
                </div>
            </div>
            {state.mode.type === 'geometry' && state.map && (
                <SelectionOptions
                    selection={state.selection}
                    map={state.map}
                    onMapChange={onMapChange} />
            )}
            {state.mode.type === 'visual' && state.map && shapes && (
                <VisualOptions
                    visualModeState={state.mode}
                    updateState={updateState}
                    shapes={shapes}
                    map={state.map}
                />
            )}
        </div>
    );
}
