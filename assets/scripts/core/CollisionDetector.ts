import type { ArrowBase } from './ArrowBase';
import type { Block } from './Block';
import { Direction } from './Direction';
import type { BlockerRef, BoardBounds, PathCheckResult } from './GameTypes';

export class CollisionDetector {
    private constructor() {}

    public static canMove(
        arrow: ArrowBase,
        arrows: readonly ArrowBase[],
        blocks: readonly Block[],
        bounds: BoardBounds,
    ): boolean {
        return CollisionDetector.inspect(arrow, arrows, blocks, bounds).canMove;
    }

    public static inspect(
        arrow: ArrowBase,
        arrows: readonly ArrowBase[],
        blocks: readonly Block[],
        bounds: BoardBounds,
    ): PathCheckResult {
        const direction = arrow.getMoveDirection();
        if (direction === null) {
            return {
                canMove: false,
                direction: null,
                reason: 'immovable',
                blocker: null,
            };
        }

        const occupancy = CollisionDetector.buildOccupancy(arrow.id, arrows, blocks);
        const delta = Direction.delta(direction);
        let cursor = arrow.head.translated(delta.x, delta.y);

        while (CollisionDetector.isInside(cursor, bounds)) {
            const blocker = occupancy.get(cursor.key());
            if (blocker !== undefined) {
                return {
                    canMove: false,
                    direction,
                    reason: 'blocked',
                    blocker: {
                        ...blocker,
                        position: cursor.clone(),
                    },
                };
            }

            cursor = cursor.translated(delta.x, delta.y);
        }

        return {
            canMove: true,
            direction,
            reason: 'clear',
            blocker: null,
        };
    }

    public static findMovableArrow(
        arrows: readonly ArrowBase[],
        blocks: readonly Block[],
        bounds: BoardBounds,
    ): ArrowBase | null {
        return (
            arrows.find(
                (arrow) =>
                    !arrow.isRemoved() &&
                    CollisionDetector.canMove(arrow, arrows, blocks, bounds),
            ) ?? null
        );
    }

    private static buildOccupancy(
        excludedArrowId: string,
        arrows: readonly ArrowBase[],
        blocks: readonly Block[],
    ): Map<string, Omit<BlockerRef, 'position'>> {
        const occupancy = new Map<string, Omit<BlockerRef, 'position'>>();

        for (const arrow of arrows) {
            if (arrow.id === excludedArrowId || arrow.isRemoved()) {
                continue;
            }
            for (const cell of arrow.body) {
                occupancy.set(cell.key(), { kind: 'arrow', id: arrow.id });
            }
        }

        for (const block of blocks) {
            for (const cell of block.cells) {
                occupancy.set(cell.key(), { kind: 'wall', id: block.id });
            }
        }

        return occupancy;
    }

    private static isInside(point: { x: number; y: number }, bounds: BoardBounds): boolean {
        return (
            point.x >= 0 &&
            point.y >= 0 &&
            point.x < bounds.columns &&
            point.y < bounds.rows
        );
    }
}
