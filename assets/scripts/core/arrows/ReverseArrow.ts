import { ArrowBase, type ArrowInitialData } from '../ArrowBase';
import { Direction, type DirectionName } from '../Direction';

export class ReverseArrow extends ArrowBase {
    public constructor(data: Omit<ArrowInitialData, 'arrowType'>) {
        super({ ...data, arrowType: 'reverse' });
    }

    public override getMoveDirection(): DirectionName {
        return Direction.opposite(this.displayDirection);
    }
}
