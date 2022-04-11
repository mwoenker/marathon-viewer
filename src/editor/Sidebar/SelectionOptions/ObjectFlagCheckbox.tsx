import type { JSXInternal } from 'preact/src/jsx';
import { ObjectFlags, ObjectType } from '../../../files/map/object';
import { impossibleValue } from '../../../utils';

interface ObjectFlagDescription {
    name: string,
    flag: ObjectFlags
}

export function objectFlagDescriptions(objType: ObjectType): ObjectFlagDescription[] {
    switch (objType) {
        case ObjectType.object:
            return [
                { flag: ObjectFlags.invisible, name: 'Invisible' },
                { flag: ObjectFlags.hangingFromCeiling, name: 'Hanging From Ceiling' },
                { flag: ObjectFlags.floating, name: 'Floating' },
                { flag: ObjectFlags.networkOnly, name: 'Network Only' },
            ];
        case ObjectType.monster:
            return [
                { flag: ObjectFlags.invisible, name: 'Invisible' },
                { flag: ObjectFlags.hangingFromCeiling, name: 'Hanging From Ceiling' },
                { flag: ObjectFlags.blind, name: 'Blind' },
                { flag: ObjectFlags.deaf, name: 'Deaf' },
                { flag: ObjectFlags.floating, name: 'Floating' },
                { flag: ObjectFlags.networkOnly, name: 'Network Only' },
            ];
        case ObjectType.item:
            return [
                { flag: ObjectFlags.invisible, name: 'Invisible' },
                { flag: ObjectFlags.hangingFromCeiling, name: 'Hanging From Ceiling' },
                { flag: ObjectFlags.floating, name: 'Floating' },
                { flag: ObjectFlags.networkOnly, name: 'Network Only' },
            ];
        case ObjectType.player:
            return [
                { flag: ObjectFlags.hangingFromCeiling, name: 'Hanging From Ceiling' },
            ];
        case ObjectType.savedSoundSource:
            return [
                { flag: ObjectFlags.platformSound, name: 'Platform Sound' },
                { flag: ObjectFlags.networkOnly, name: 'Network Only' },
            ];
        case ObjectType.goal:
            return [
                { flag: ObjectFlags.invisible, name: 'Invisible' },
                { flag: ObjectFlags.hangingFromCeiling, name: 'Hanging From Ceiling' },
                { flag: ObjectFlags.blind, name: 'Blind' },
                { flag: ObjectFlags.deaf, name: 'Deaf' },
                { flag: ObjectFlags.floating, name: 'Floating' },
                { flag: ObjectFlags.networkOnly, name: 'Network Only' },
            ];
        default:
            impossibleValue(objType);
    }
}

interface ObjectTypeDropdownProps {
    flag: ObjectFlags
    value: boolean
    onChange(flag: ObjectFlags, newVal: boolean): void
}

export function ObjectFlagCheckbox({ flag, value, onChange }: ObjectTypeDropdownProps): JSX.Element {
    const change = (e: JSXInternal.TargetedEvent<HTMLInputElement>) => {
        const newValue = e.currentTarget.checked;
        onChange(flag, newValue);
    };

    return (
        <input type="checkbox" checked={value} onChange={change} />
    );
}

