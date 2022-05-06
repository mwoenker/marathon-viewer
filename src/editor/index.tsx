import { useState, } from 'react';
import { render } from 'preact/compat';
import './index.css';

import {
    readMapSummaries, readMapFromSummary, MapSummary
} from '../files/wad';

import { HtmlInputFile } from '../files/binary-read';
import { MapGeometry } from '../files/map';
import { Sidebar } from './Sidebar';
import { RightPanel } from './RightPanel';
import { useEditorState } from './state';

interface MapFileSetting {
    file: File | null,
    summaries: MapSummary[]
}

function Editor() {
    const [mapFile, setMapFile] = useState<MapFileSetting>({ file: null, summaries: [] });
    // size of screen pixel in map units
    const [state, updateState] = useEditorState();

    const uploadMap = async (file: File) => {
        const summaries = await readMapSummaries(new HtmlInputFile(file));
        setMapFile({ file, summaries });
        if (summaries.length > 0) {
            updateState({ type: 'setMap', map: await readMapFromSummary(summaries[0]) });
        }
    };

    function setMap(map: MapGeometry) {
        updateState({ type: 'setMap', map });
    }

    async function setSelectedMap(summary: MapSummary) {
        setMap(await readMapFromSummary(summary));
    }

    return (
        <div className="editor">
            <Sidebar
                onMapUpload={uploadMap}
                map={state.map}
                onMapChange={setMap}
                mapSummaries={mapFile.summaries}
                onMapSelected={setSelectedMap}
                selection={state.selection}
            />
            <RightPanel
                state={state}
                updateState={updateState}
            />
        </div>
    );
}

const appElement = document.getElementById('app');
if (appElement) {
    render(<Editor />, appElement);
}
