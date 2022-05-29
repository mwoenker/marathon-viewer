import { Player } from './player';
import { MapGeometry } from './files/map';
import { ScreenTransform } from './screen-transform';
import { World } from './world';
import { Transformation } from './transform2d';
import { v3scale, Vec3 } from './vector3';
import { worldUnitSize } from './constants';
import { ConnectedSurface, getConnectedSurfaces } from './surface';
import { TransferMode } from './files/wad';

export function textureClickedSurface(
    canvas: HTMLCanvasElement,
    player: Player,
    world: World,
    map: MapGeometry,
    x: number,
    y: number,
    shape: number,
    flood = true
): MapGeometry {
    const screenTransform = new ScreenTransform(
        canvas.width, canvas.height, player.hFov, player.vFov, player.verticalAngle);
    const viewRay = v3scale(100 * worldUnitSize, screenTransform.screenToRay(x, y));
    const viewTransform = new Transformation(player.position, player.facingAngle);
    const worldEnd2d = viewTransform.unTransform([viewRay[0], viewRay[2]]);
    const ray: Vec3 = [worldEnd2d[0], worldEnd2d[1], player.height + viewRay[1]];
    const intercept = world.intersectLineSegment(
        player.polygon,
        [...player.position, player.height],
        ray,
    );

    if (!intercept) {
        return map;
    }

    const clickedInfo = map.getSurfaceInfo(intercept);

    let surfaces: ConnectedSurface[];

    if (flood) {
        surfaces = getConnectedSurfaces(map, intercept, (surface) => {
            const info = map.getSurfaceInfo(surface);
            return info.shape === clickedInfo.shape;
        });
    } else {
        surfaces = [{ texOffset: [0, 0], surface: intercept }];
    }

    console.log({ surfaces });

    for (const connectedSurface of surfaces) {
        const { surface, texOffset } = connectedSurface;
        map = map.setSurfaceTextureInfo(surface, {
            texCoords: texOffset,
            shape: shape,
            light: 0,
            transferMode: TransferMode.normal
        });
    }

    world.updateMap(map);
    return map;
}
