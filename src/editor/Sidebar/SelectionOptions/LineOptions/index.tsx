import { OptionsProps } from "../OptionsProps";

export function LineOptions(props: OptionsProps): JSX.Element {
    return <div>{`Line: ${props.index}`}</div>;
}
