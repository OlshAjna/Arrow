import { GridPoint } from './GridPoint';

export type DirectionName = 'up' | 'down' | 'left' | 'right';

export class Direction {
    public static readonly UP: DirectionName = 'up';
    public static readonly DOWN: DirectionName = 'down';
    public static readonly LEFT: DirectionName = 'left';
    public static readonly RIGHT: DirectionName = 'right';

    private static readonly ALL: readonly DirectionName[] = [
        Direction.UP,
        Direction.DOWN,
        Direction.LEFT,
        Direction.RIGHT,
    ];

    private constructor() {}

    public static isName(value: unknown): value is DirectionName {
        return typeof value === 'string' && Direction.ALL.includes(value as DirectionName);
    }

    public static opposite(direction: DirectionName): DirectionName {
        switch (direction) {
            case Direction.UP:
                return Direction.DOWN;
            case Direction.DOWN:
                return Direction.UP;
            case Direction.LEFT:
                return Direction.RIGHT;
            case Direction.RIGHT:
                return Direction.LEFT;
            default:
                throw new Error(`Unsupported direction: ${direction}`);
        }
    }

    public static delta(direction: DirectionName): GridPoint {
        switch (direction) {
            case Direction.UP:
                return new GridPoint(0, -1);
            case Direction.DOWN:
                return new GridPoint(0, 1);
            case Direction.LEFT:
                return new GridPoint(-1, 0);
            case Direction.RIGHT:
                return new GridPoint(1, 0);
            default:
                throw new Error(`Unsupported direction: ${direction}`);
        }
    }

    public static isHorizontal(direction: DirectionName): boolean {
        return direction === Direction.LEFT || direction === Direction.RIGHT;
    }
}
