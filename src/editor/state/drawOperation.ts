import { Vec2 } from '../../vector2'

interface ExistingStartPoint {
    type: 'existing';
    pointIndex: number;
}

interface NewStartPoint {
    type: 'new';
    position: Vec2;
}

type StartPoint = ExistingStartPoint | NewStartPoint;

export interface DrawOperation {
    startPoint: StartPoint;

}
