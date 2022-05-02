import { OptionsProps } from "../OptionsProps";

export function PointOptions(props: OptionsProps): JSX.Element {
    return <div>{`Point: ${props.index}`}</div>;
}
