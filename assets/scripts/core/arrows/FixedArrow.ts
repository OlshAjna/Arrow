import { ArrowBase, type ArrowInitialData } from '../ArrowBase';
import type { DirectionName } from '../Direction';

export class FixedArrow extends ArrowBase {
    public constructor(data: Omit<ArrowInitialData, 'arrowType'>) {
        super({ ...data, arrowType: 'fixed' });
    }

    public override getMoveDirection(): DirectionName | null {
        return null;
    }
}
