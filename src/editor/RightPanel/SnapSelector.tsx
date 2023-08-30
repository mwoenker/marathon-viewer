import { SnapGridSize, snapGridSettings } from "../state/snapGrid";

export interface SnapSelectorProps {
    value: SnapGridSize
    onChange: (newVal: SnapGridSize) => void;
}

export function SnapSelector({ value, onChange }: SnapSelectorProps): JSX.Element {
    const valueSelected = (value: string) => {
        const optionIndex = parseInt(value);
        if (optionIndex >= 0 && optionIndex < snapGridSettings.length) {
            onChange(snapGridSettings[optionIndex].size);
        }
    };

    return (
        <select onChange={e => valueSelected(e.currentTarget.value)}>
            {snapGridSettings.map((setting, idx) => {
                return (
                    <option
                        key={setting.size}
                        value={idx}
                        selected={setting.size === value}
                    >
                        {setting.label}
                    </option>
                );
            })}
        </select>
    );
}

