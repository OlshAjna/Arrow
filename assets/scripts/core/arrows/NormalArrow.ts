import { ArrowBase, type ArrowInitialData } from '../ArrowBase';
import type { DirectionName } from '../Direction';

export class NormalArrow extends ArrowBase {
    public constructor(data: Omit<ArrowInitialData, 'arrowType'>) {
        super({ ...data, arrowType: 'normal' });
    }

    public override getMoveDirection(): DirectionName {
        return this.displayDirection;
    }
}
