import type { DirectionName } from './Direction';
import type { GridPoint } from './GridPoint';

export type ArrowKind = 'normal' | 'fixed' | 'reverse';
export type ArrowState = 'idle' | 'moving' | 'returning' | 'removed';
export type GameStatus = 'idle' | 'playing' | 'won' | 'lost';

export interface BoardBounds {
    rows: number;
    columns: number;
}

export interface BlockerRef {
    kind: 'arrow' | 'wall';
    id: string;
    position: GridPoint;
}

export interface PathCheckResult {
    canMove: boolean;
    direction: DirectionName | null;
    reason: 'clear' | 'immovable' | 'blocked';
    blocker: BlockerRef | null;
}
