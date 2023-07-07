import { OptionsProps } from "../OptionsProps";

export function PolygonOptions({ map, index }: OptionsProps): JSX.Element {
    const polygon = map.getPolygon(index);

    return (
        <>
            <div>{`Polygon: ${index}`}</div>
            <div>Floor height: {polygon.floorHeight}</div>
            <div>Ceiling height: {polygon.ceilingHeight}</div>
        </>
    );
}
