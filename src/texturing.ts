import { Player } from './player';
import { MapGeometry } from './files/map';
import { ScreenTransform } from './screen-transform';
import { World } from './world';
import { Transformation } from './transform2d';
import { makeShapeDescriptor } from './files/shapes';
import { v3scale, Vec3 } from './vector3';

export function textureClickedSurface(canvas: HTMLCanvasElement, player: Player, world: World, map: MapGeometry, x: number, y: number): MapGeometry {
    const screenTransform = new ScreenTransform(
        canvas.width, canvas.height, player.hFov, player.vFov, player.verticalAngle);
    const viewRay = v3scale(100, screenTransform.screenToRay(x, y));
    const viewTransform = new Transformation(player.position, player.facingAngle);
    const worldEnd2d = viewTransform.unTransform([viewRay[0], viewRay[2]]);
    const ray: Vec3 = [worldEnd2d[0], worldEnd2d[1], player.height + viewRay[1]];
    const intercept = world.intersectLineSegment(
        player.polygon,
        [...player.position, player.height],
        ray,
    );

    if (intercept) {
        const { polygonIndex } = intercept;
        const shape = makeShapeDescriptor(0, 18, 5);
        if (intercept.type === 'floor') {
            map = map.setFloorTexture({ polygonIndex, shape, offset: [0, 0] });
        } else if (intercept.type === 'ceiling') {
            map = map.setCeilingTexture({ polygonIndex, shape, offset: [0, 0] });
        } else if (intercept.type === 'wallPrimary') {
            const { polygonIndex, wallIndex, sideType } = intercept;
            map = map.setWallTexture({
                polygonIndex,
                wallIndex,
                sideType,
                textureSlot: 'primary',
                shape,
                offset: [0, 0],
            });
        } else if (intercept.type === 'wallSecondary') {
            const { polygonIndex, wallIndex, sideType } = intercept;
            map = map.setWallTexture({
                polygonIndex,
                wallIndex,
                sideType,
                textureSlot: 'secondary',
                shape,
                offset: [0, 0],
            });
        }

        world.updateMap(map);
    }

    return map;
}
