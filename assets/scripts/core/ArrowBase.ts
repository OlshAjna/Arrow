import { Direction, type DirectionName } from './Direction';
import type { ArrowKind, ArrowState } from './GameTypes';
import { GridPoint } from './GridPoint';

export interface ArrowInitialData {
    id: string;
    arrowType: ArrowKind;
    displayDirection: DirectionName;
    body: readonly GridPoint[];
    drawOrder?: number;
}

export abstract class ArrowBase {
    public readonly id: string;
    public readonly arrowType: ArrowKind;
    public readonly displayDirection: DirectionName;
    public readonly drawOrder: number;

    private bodyCells: GridPoint[];
    private readonly initialBody: GridPoint[];
    private currentState: ArrowState = 'idle';

    protected constructor(data: ArrowInitialData) {
        if (data.body.length === 0) {
            throw new Error(`Arrow "${data.id}" must contain at least one body cell.`);
        }

        this.id = data.id;
        this.arrowType = data.arrowType;
        this.displayDirection = data.displayDirection;
        this.drawOrder = data.drawOrder ?? 0;
        this.bodyCells = data.body.map((point) => point.clone());
        this.initialBody = data.body.map((point) => point.clone());
    }

    public get head(): GridPoint {
        return this.bodyCells[0]!.clone();
    }

    public get body(): readonly GridPoint[] {
        return this.bodyCells.map((point) => point.clone());
    }

    public get state(): ArrowState {
        return this.currentState;
    }

    public isMovable(): boolean {
        return this.getMoveDirection() !== null;
    }

    public isRemoved(): boolean {
        return this.currentState === 'removed';
    }

    public move(): boolean {
        if (!this.isMovable() || this.currentState === 'removed') {
            return false;
        }

        this.currentState = 'moving';
        return true;
    }

    public beginReturn(): void {
        if (this.currentState !== 'removed') {
            this.currentState = 'returning';
        }
    }

    public eliminate(): void {
        this.currentState = 'removed';
    }

    public reset(): void {
        this.bodyCells = this.initialBody.map((point) => point.clone());
        this.currentState = 'idle';
    }

    public occupies(position: GridPoint): boolean {
        return this.bodyCells.some((cell) => cell.equals(position));
    }

    public abstract getMoveDirection(): DirectionName | null;
}
