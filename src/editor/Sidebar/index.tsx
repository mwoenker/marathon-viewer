import type { JSXInternal } from 'preact/src/jsx';
import type { MapSummary } from '../../files/wad';
import type { MapGeometry } from '../../files/map';
import { Selection } from '../selection';

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
    mapSummaries: MapSummary[]
    onMapSelected(map: MapSummary): void
    selection: Selection
}

export function Sidebar({
    onMapUpload,
    mapSummaries,
    map,
    onMapSelected,
    selection
}: SidebarProps): JSX.Element {
    const fileSelected = async (e: JSXInternal.TargetedEvent<HTMLInputElement>) => {
        if (e && e.target && e.currentTarget.files && e.currentTarget.files[0]) {
            onMapUpload(e.currentTarget.files[0]);
        }
    };

    return (
        <div className="leftPanel">
            <div>
                <input type="file" onChange={fileSelected} />
            </div>
            <MapList
                maps={mapSummaries}
                selectedMap={map}
                onMapSelected={onMapSelected} />
            {selection.objType}
        </div>
    );
}
