import type { JSXInternal } from 'preact/src/jsx';
import { ObjectType } from '../../../../files/map/object';

interface ObjectTypeDropdownProps {
    value: ObjectType
    onChange(newType: ObjectType): void
}

export function ObjectTypeDropdown({ value, onChange }: ObjectTypeDropdownProps): JSX.Element {
    const change = (e: JSXInternal.TargetedEvent<HTMLSelectElement>) => {
        const value = parseInt(e.currentTarget.value);
        switch (value) {
            case ObjectType.monster:
            case ObjectType.object:
            case ObjectType.item:
            case ObjectType.player:
            case ObjectType.goal:
            case ObjectType.savedSoundSource:
                onChange(value);
                break;
            default:
                throw new Error(`Invalid object type: ${value}`);
        }
    };

    return (
        <select value={value} onChange={change}>
            <option value={ObjectType.monster}>Monster</option>
            <option value={ObjectType.object}>Object</option>
            <option value={ObjectType.item}>Item</option>
            <option value={ObjectType.player}>Player</option>
            <option value={ObjectType.goal}>Goal</option>
            <option value={ObjectType.savedSoundSource}>Sound</option>
        </select>
    );
}

