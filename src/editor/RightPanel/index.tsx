import { MapGeometry } from '../../files/map';
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
    onZoomOut(): void
}

export function RightPanel({
    pixelSize,
    map,
    onMapChange,
    onZoomIn,
    onZoomOut
}: RightPanelProps): JSX.Element {
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
                </div>
                {map && (
                    <MapSummary map={map} />
                )}
            </div>
            <MapView map={map}
                onMapChange={onMapChange}
                pixelSize={pixelSize}
            />
        </div>
    );
}
