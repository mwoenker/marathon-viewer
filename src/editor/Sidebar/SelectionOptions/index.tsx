import type { MapGeometry } from '../../../files/map';
import { Selection } from '../../state';
import { LineOptions } from './LineOptions';
import { ObjectOptions } from './ObjectOptions';
import { PointOptions } from './PointOptions';
import { PolygonOptions } from './PolygonOptions';

interface SelectionOptionsProps {
    map: MapGeometry
    selection: Selection
    onMapChange(map: MapGeometry): void
}

export function SelectionOptions({ map, onMapChange, selection }: SelectionOptionsProps): JSX.Element | null {
    if (selection.objType === 'object') {
        return (
            <ObjectOptions map={map} onMapChange={onMapChange} index={selection.index} />
        );
    } else if (selection.objType === 'polygon') {
        return <PolygonOptions map={map} onMapChange={onMapChange} index={selection.index} />;
    } else if (selection.objType === 'line') {
        return <LineOptions map={map} onMapChange={onMapChange} index={selection.index} />;
    } else if (selection.objType === 'point') {
        return <PointOptions map={map} onMapChange={onMapChange} index={selection.index} />;
    } else {
        return null;
    }
}
