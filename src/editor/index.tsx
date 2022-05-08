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
import { Shapes } from '../shapes-loader';

interface MapFileSetting {
    file: File | null,
    summaries: MapSummary[]
}

function Editor() {
    const [mapFile, setMapFile] = useState<MapFileSetting>({ file: null, summaries: [] });
    // size of screen pixel in map units
    const [state, updateState] = useEditorState();
    const [shapes, setShapes] = useState<Shapes | null>(null);

    const selectMap = async (file: File) => {
        const summaries = await readMapSummaries(new HtmlInputFile(file));
        setMapFile({ file, summaries });
        if (summaries.length > 0) {
            updateState({ type: 'setMap', map: await readMapFromSummary(summaries[0]) });
        }
    };

    const selectShapes = async (file: File) => {
        setShapes(new Shapes(new HtmlInputFile(file)));
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
                onMapFileSelected={selectMap}
                onShapesFileSelected={selectShapes}
                map={state.map}
                onMapChange={setMap}
                mapSummaries={mapFile.summaries}
                onMapSelected={setSelectedMap}
                selection={state.selection}
            />
            <RightPanel
                state={state}
                updateState={updateState}
                shapes={shapes}
            />
        </div>
    );
}

const appElement = document.getElementById('app');
if (appElement) {
    render(<Editor />, appElement);
}
