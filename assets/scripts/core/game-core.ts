import { createArrow, type ArrowBase } from './arrows';
import { castRay } from './collision';
import { distanceToBoardEdge } from './math';
import { validateLevel } from './level-validation';
import type {
  ArrowConfig,
  GameSnapshot,
  GameStatus,
  LevelConfig,
  MoveCheck,
  WallConfig,
} from './types';

export interface BlockedReason {
  type: 'blocked' | 'fixed';
  blockerId?: string;
}

/**
 * 纯逻辑对局核心：不依赖渲染、输入、Cocos 或 DOM。
 * 表现层只通过 checkMove → 播动画 → commitClear / registerBlocked 驱动它。
 */
export class GameCore {
  private readonly level: LevelConfig;
  private readonly initialArrowConfigs: ArrowConfig[];
  private readonly initialWalls: WallConfig[];
  private arrows: ArrowBase[];
  private readonly walls: WallConfig[];
  private readonly maxLives: number;
  private readonly initialHints: number;

  status: GameStatus = 'playing';
  lives: number;
  hints: number;
  message = '';

  constructor(level: LevelConfig) {
    validateLevel(level);
    this.level = {
      ...level,
      arrows: level.arrows.map((a) => ({ ...a })),
      walls: (level.walls ?? []).map((w) => ({ ...w })),
    };
    this.initialArrowConfigs = this.level.arrows.map((a) => ({ ...a }));
    this.initialWalls = this.level.walls.map((w) => ({ ...w }));
    this.maxLives = level.lives;
    this.initialHints = level.hints;
    this.lives = level.lives;
    this.hints = level.hints;
    this.walls = this.level.walls;
    this.arrows = this.initialArrowConfigs.map(createArrow);
  }

  get levelInfo(): Readonly<LevelConfig> {
    return this.level;
  }

  get maxLife(): number {
    return this.maxLives;
  }

  getArrows(): readonly ArrowBase[] {
    return this.arrows;
  }

  getWalls(): readonly WallConfig[] {
    return this.walls;
  }

  getArrow(id: string): ArrowBase | undefined {
    return this.arrows.find((a) => a.id === id);
  }

  get remainingMovable(): number {
    return this.arrows.filter((a) => a.alive && a.movable).length;
  }

  get totalMovable(): number {
    return this.initialArrowConfigs.filter((a) => (a.type ?? 'normal') !== 'fixed').length;
  }

  /**
   * 射线判定：只读，不改变任何状态。
   * 表现层拿到结果后再决定播“滑出”还是“退回”动画。
   */
  checkMove(id: string): MoveCheck {
    if (this.status !== 'playing') throw new Error('GAME_NOT_PLAYING');
    const arrow = this.getArrow(id);
    if (!arrow || !arrow.alive) throw new Error('ARROW_NOT_FOUND');

    if (!arrow.movable) {
      return { kind: 'fixed', arrowId: id, direction: arrow.moveDirection, distance: 0 };
    }

    const direction = arrow.moveDirection;
    const origin = arrow.headPoint;
    const maxDistance = distanceToBoardEdge(
      origin,
      arrow.moveVector,
      this.level.width,
      this.level.height,
    );
    const hit = castRay(
      origin,
      direction,
      this.level.width,
      this.level.height,
      this.walls,
      this.arrows,
      arrow.id,
    );

    if (hit) {
      return {
        kind: 'blocked',
        arrowId: id,
        direction,
        distance: hit.distance,
        hit,
      };
    }

    return {
      kind: 'clear',
      arrowId: id,
      direction,
      distance: maxDistance + 80,
    };
  }

  /** 动画结束后调用：从棋盘删除箭头，并检查胜利。 */
  commitClear(id: string): boolean {
    if (this.status !== 'playing') return false;
    const arrow = this.getArrow(id);
    if (!arrow || !arrow.alive) return false;
    arrow.alive = false;

    if (this.remainingMovable === 0) {
      this.status = 'won';
      this.message = '全部可移动箭头已清空，通关！';
    } else {
      this.message = `已消除 ${id}`;
    }
    return true;
  }

  /** 退回动画结束后调用：扣生命；固定箭头也走这里。 */
  registerBlocked(id: string, reason: BlockedReason): void {
    if (this.status !== 'playing') return;
    this.lives = Math.max(0, this.lives - 1);

    if (reason.type === 'fixed') {
      this.message = '固定箭头不可移动，生命 -1';
    } else if (reason.blockerId === id) {
      this.message = '线条自身的折返挡住了出口，生命 -1';
    } else if (reason.blockerId) {
      this.message = `路径被 ${reason.blockerId} 挡住，生命 -1`;
    } else {
      this.message = '路径被挡住，生命 -1';
    }

    if (this.lives <= 0) {
      this.status = 'lost';
      this.message = '生命耗尽，挑战失败';
    }
  }

  /**
   * 提示：找一支当前路径畅通、可立即消除的箭头。
   * 找不到时不消耗次数，避免玩家在死局里被“骗走”道具。
   */
  useHint(): string | null {
    if (this.status !== 'playing') return null;
    if (this.hints <= 0) {
      this.message = '提示道具已用完';
      return null;
    }

    const candidates = this.arrows
      .filter((a) => a.alive && a.movable)
      .sort((a, b) => b.layer - a.layer || a.id.localeCompare(b.id));

    for (const arrow of candidates) {
      const result = this.checkMove(arrow.id);
      if (result.kind === 'clear') {
        this.hints -= 1;
        this.message = `提示：${arrow.id} 当前可以消除`;
        return arrow.id;
      }
    }

    this.message = '当前没有可直接消除的箭头，试试重置';
    return null;
  }

  reset(): void {
    this.arrows = this.initialArrowConfigs.map(createArrow);
    this.lives = this.maxLives;
    this.hints = this.initialHints;
    this.status = 'playing';
    this.message = '关卡已重置';
  }

  snapshot(): GameSnapshot {
    return {
      status: this.status,
      lives: this.lives,
      maxLives: this.maxLives,
      hints: this.hints,
      remainingMovable: this.remainingMovable,
      totalMovable: this.totalMovable,
      message: this.message,
    };
  }
}
