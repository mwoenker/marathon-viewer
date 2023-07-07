import { OptionsProps } from "../OptionsProps";

export function LineOptions({ map, index }: OptionsProps): JSX.Element {
    return <div>{`Line: ${index}`}</div>;
}
