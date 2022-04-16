import type { JSXInternal } from 'preact/src/jsx';
import { MapSummary, readMapFromSummary, readMapSummaries, serializeWad } from '../../files/wad';
import type { MapGeometry } from '../../files/map';
import { Selection } from '../selection';
import { SelectionOptions } from './SelectionOptions';
import { ArrayBufferFile } from '../../files/binary-read';

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
        <select value={selectedMap ? selectedMap.index : ''} onChange={change}>
            {maps.map((m) => {
                return (
                    <option key={m.index}
                        value={m.index}
                        selected={selectedMap && selectedMap.index === m.index}
                    >
                        {m.directoryEntry.levelName}
                    </option>
                );
            })
            }
        </select>
    );
}

interface SidebarProps {
    onMapUpload: (file: File) => void
    map: MapGeometry | undefined
    onMapChange(map: MapGeometry): void
    mapSummaries: MapSummary[]
    onMapSelected(map: MapSummary): void
    selection: Selection
}

export function Sidebar({
    onMapUpload,
    mapSummaries,
    map,
    onMapChange,
    onMapSelected,
    selection,
}: SidebarProps): JSX.Element {
    const fileSelected = async (e: JSXInternal.TargetedEvent<HTMLInputElement>) => {
        if (e && e.target && e.currentTarget.files && e.currentTarget.files[0]) {
            onMapUpload(e.currentTarget.files[0]);
        }
    };

    const save = async () => {
        if (map) {
            const data = serializeWad([map], 'map.sceA');
            const url = URL.createObjectURL(new Blob([data]));
            const link = document.createElement('a');
            link.href = url;
            link.download = 'map.sceA';
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            URL.revokeObjectURL(url);
        }
    };

    return (
        <div className="leftPanel">
            <div>
                <input type="file" onChange={fileSelected} />
            </div>
            <button onClick={save}>Save!</button>
            <MapList
                maps={mapSummaries}
                selectedMap={map}
                onMapSelected={onMapSelected} />
            {map && (
                <SelectionOptions selection={selection} map={map} onMapChange={onMapChange} />
            )}
        </div>
    );
}
