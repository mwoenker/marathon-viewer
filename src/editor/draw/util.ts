import { ObjectType } from '../../files/map/object';
import colors from '../colors';
import { impossibleValue } from '../../utils';

// Striped red line pattern that polygon is drawn w/ if non convex
let nonConvexPattern: CanvasPattern | null;
export function getNonConvexPattern(): CanvasPattern {
    if (!nonConvexPattern) {
        const canvas = document.createElement('canvas');
        canvas.width = 10;
        canvas.height = 10;
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Can\'t get context');
        }
        context.fillStyle = colors.nonconvexWarning;
        const polys = [
            [[0, 8], [8, 0], [10, 0], [10, 2], [2, 10], [0, 10]],
            [[0, 0], [0, 2], [2, 0]],
            [[10, 10], [8, 10], [10, 8]],
        ];
        for (const poly of polys) {
            context.beginPath();
            context.moveTo(poly[0][0], poly[0][1]);
            for (let i = 1; i < poly.length; ++i) {
                context.lineTo(poly[i][0], poly[i][1]);
            }
            context.fill();
        }
        const pattern = context.createPattern(canvas, 'repeat');
        if (!pattern) {
            throw new Error('createPattern failed');
        }
        nonConvexPattern = pattern;
        return pattern;
    }
    return nonConvexPattern;
}

export function objectColor(objectType: ObjectType): string {
    switch (objectType) {
        case ObjectType.monster: return colors.monster;
        case ObjectType.object: return colors.scenery;
        case ObjectType.item: return colors.item;
        case ObjectType.player: return colors.player;
        case ObjectType.goal: return colors.goal;
        case ObjectType.savedSoundSource: return colors.soundSource;
        default:
            impossibleValue(objectType);
    }

}

