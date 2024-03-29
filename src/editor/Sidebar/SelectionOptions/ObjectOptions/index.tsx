import { MapObject, ObjectFlags, ObjectType } from '../../../../files/map/object';
import { ObjectTypeDropdown } from './ObjectTypeDropdown';
import { ObjectFlagCheckbox, objectFlagDescriptions } from './ObjectFlagCheckbox';
import { OptionsProps } from '../OptionsProps';
import { Facing } from '../../../components/Facing';

export function ObjectOptions({ map, onMapChange, index }: OptionsProps): JSX.Element {
    const object = map.objects[index];

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

    const changeFacing = (facing: number, isEphemeral: boolean) => {
        onMapChange(
            map.updateObject(index, new MapObject({
                ...object,
                facing: Math.floor(facing * 512 + 512) % 512
            })),
            isEphemeral
        );
    };

    if (!object) {
        return <div>Object not found</div>;
    } else {
        const flags = objectFlagDescriptions(object.type);

        return (
            <table>
                <tr>
                    <th>Type</th>
                    <td>
                        <ObjectTypeDropdown value={object.type} onChange={changeObjectType} />
                    </td>
                </tr>
                <tr>
                    <th>Facing</th>
                    <td>
                        <Facing
                            width={50}
                            height={50}
                            facing={object.facing / 512}
                            onChange={changeFacing}
                        />
                    </td>
                </tr>
                {flags.map(({ flag, name }) => (
                    <tr key={name}>
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

