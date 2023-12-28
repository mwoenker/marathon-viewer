import { useState, } from 'react';
import { render } from 'preact/compat';
import './index.css';

import {
    readMapSummaries, readMapFromSummary, MapSummary
} from '../files/wad';

import { HtmlInputFile, HttpFile } from '../files/binary-read';
import { MapGeometry } from '../files/map';
import { Sidebar } from './Sidebar';
import { RightPanel } from './RightPanel';
import { useEditorState } from './state';
import { Shapes } from '../shapes-loader';
import { useKeyboardShortcuts } from './shortcuts';

const shapesUrl = 'minf.shpA';

interface MapFileSetting {
    file: File | null,
    summaries: MapSummary[]
}

function Editor() {
    const [mapFile, setMapFile] = useState<MapFileSetting>({ file: null, summaries: [] });
    const [state, updateState] = useEditorState();
    const [shapes, setShapes] = useState<Shapes>(new Shapes(new HttpFile(shapesUrl)));
    useKeyboardShortcuts(updateState);

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

    function setMap(map: MapGeometry, isEphemeral = false) {
        updateState({ type: 'setMap', map, isEphemeral });
    }

    async function setSelectedMap(summary: MapSummary) {
        setMap(await readMapFromSummary(summary));
    }

    return (
        <div className="editor">
            <Sidebar
                onMapFileSelected={selectMap}
                shapes={shapes}
                onShapesFileSelected={selectShapes}
                onMapChange={setMap}
                mapSummaries={mapFile.summaries}
                onMapSelected={setSelectedMap}
                state={state}
                updateState={updateState}
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
