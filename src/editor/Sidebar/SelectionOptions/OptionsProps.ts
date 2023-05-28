import type { MapGeometry } from '../../../files/map';

export interface OptionsProps {
    index: number
    map: MapGeometry,
    onMapChange(map: MapGeometry, isEphemeral?: boolean): void
}
