import { LineFlag } from "../../../../files/map/line";
import { OptionsProps } from "../OptionsProps";

export function LineOptions({ map, index }: OptionsProps): JSX.Element {
    const line = map.getLine(index);
    const frontSide =
        line.frontSide !== -1 ? map.getSide(line.frontSide) : undefined;
    const backSide =
        line.backSide !== -1 ? map.getSide(line.backSide) : undefined;

    const flags = [];
    for (const [name, val] of Object.entries(LineFlag)) {
        if (typeof val === 'number' && line.hasFlag(val)) {
            flags.push(name);
        }
    }

    return (
        <div>
            <div>{`Line: ${index}`}</div>
            <div>
                {`Front side ${line.frontSide}`}
                {frontSide && (
                    <>
                        <div>
                            {`Front side type ${frontSide.type}`}
                        </div>
                        <div>
                            {`Front side primary texture ${frontSide.primaryTexture.texture}`}
                        </div>
                        <div>
                            {`Front side secondary texture ${frontSide.secondaryTexture.texture}`}
                        </div>
                        <div>
                            {`Front side transparent texture ${frontSide.transparentTexture.texture}`}
                        </div>
                        <pre>
                            {JSON.stringify(frontSide, null, 2)}
                        </pre>
                    </>
                )}
            </div>
            <div>
                {`Flags: ${flags.join(', ')}`}
            </div>
            <div>{`Front polygon ${line.frontPoly}`}</div>
            <div>{`Back side ${line.backSide}`}</div>
            {backSide && (
                <>
                    <div>
                        {`Back side type ${backSide.type}`}
                    </div>
                    <div>
                        {`Front side primary texture ${backSide.primaryTexture.texture}`}
                    </div>
                    <div>
                        {`Front side secondary texture ${backSide.secondaryTexture.texture}`}
                    </div>
                    <div>
                        {`Front side transparent texture ${backSide.transparentTexture.texture}`}
                    </div>
                </>
            )}
            <div>{`Back polygon ${line.backPoly}`}</div>
        </div>
    );
}
