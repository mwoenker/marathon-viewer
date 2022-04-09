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

interface MapFileSetting {
    file: File | null,
    summaries: MapSummary[]
}

function Editor() {
    const [mapFile, setMapFile] = useState<MapFileSetting>({ file: null, summaries: [] });
    const [map, setMap] = useState<MapGeometry>();
    // size of screen pixel in map units
    const [pixelSize, setPixelSize] = useState(64);

    const uploadMap = async (file: File) => {
        const summaries = await readMapSummaries(new HtmlInputFile(file));
        setMapFile({ file, summaries });
    };

    async function setSelectedMap(summary: MapSummary) {
        setMap(await readMapFromSummary(summary));
    }

    const zoomIncrement = 1.5;

    function zoomIn() {
        setPixelSize(pixelSize / zoomIncrement);
    }

    function zoomOut() {
        setPixelSize(pixelSize * zoomIncrement);
    }

    return (
        <div className="editor">
            <Sidebar
                onMapUpload={uploadMap}
                map={map}
                mapSummaries={mapFile.summaries}
                onMapSelected={setSelectedMap}
            />
            <RightPanel
                pixelSize={pixelSize}
                map={map}
                onMapChange={setMap}
                onZoomIn={zoomIn}
                onZoomOut={zoomOut}
            />
        </div>
    );
}

const appElement = document.getElementById('app');
if (appElement) {
    render(<Editor />, appElement);
}
