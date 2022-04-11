import type { MapGeometry } from '../../../files/map';
import { Selection } from '../../selection';
import { MapObject, ObjectFlags, ObjectType } from '../../../files/map/object';
import { ObjectTypeDropdown } from './ObjectTypeDropdown';
import { ObjectFlagCheckbox, objectFlagDescriptions } from './ObjectFlagCheckbox';

interface ObjectOptionsProps {
    index: number
    map: MapGeometry,
    onMapChange(map: MapGeometry): void
}

function ObjectOptions({ map, onMapChange, index }: ObjectOptionsProps): JSX.Element {
    const object = map.objects[index];
    if (!object) {
        return <div>Object not found</div>;
    } else {
        const changeObjectType = (newType: ObjectType) => {
            if (newType !== object.type) {
                onMapChange(map.updateObject(index, new MapObject({
                    ...object,
                    type: newType,
                    flags: 0
                })));
            }
        };

        const changeObjectFlags = (flag: ObjectFlags, value: boolean) => {
            onMapChange(map.updateObject(index, new MapObject({
                ...object,
                flags: object.flags & (~flag) | (value ? flag : 0),
            })));
        };

        const flags = objectFlagDescriptions(object.type);

        return (
            <table>
                <tr>
                    <th>Type</th>
                    <td>
                        <ObjectTypeDropdown value={object.type} onChange={changeObjectType} />
                    </td>
                </tr>
                {flags.map(({ flag, name }) => (
                    <tr>
                        <th>{name}</th>
                        <td>
                            <ObjectFlagCheckbox
                                flag={flag}
                                value={(object.flags & flag) !== 0}
                                onChange={changeObjectFlags}
                            />
                        </td>
                    </tr>
                ))}
            </table>
        );
    }
}

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
    } else {
        return null;
    }
}
