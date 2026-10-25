import { arrowBounds } from './geometry';
import { DIR_VECTORS, oppositeDirection } from './math';
import type { ArrowConfig, ArrowType, Direction, Rect, Vec2 } from './types';

export abstract class ArrowBase {
  readonly id: string;
  readonly type: ArrowType;
  readonly layer: number;
  readonly bend: -1 | 0 | 1;
  /** 外观锚点；受阻退回时不允许修改。 */
  readonly x: number;
  readonly y: number;
  /** 外观朝向。实际移动方向由 moveDirection 决定。 */
  readonly dir: Direction;
  /** 可选折线中心线（尾 → 头）；长线条使用。 */
  readonly points?: readonly Vec2[];
  alive = true;

  protected constructor(config: ArrowConfig, type: ArrowType) {
    this.id = config.id;
    this.x = config.x;
    this.y = config.y;
    this.dir = config.dir;
    this.type = type;
    this.layer = config.layer ?? 1;
    this.bend = config.bend ?? 0;
    this.points = config.points?.map((p) => ({ x: p.x, y: p.y }));
  }

  abstract get movable(): boolean;

  /** 射线起点：长线条从箭头尖端出发；短箭头保持原锚点行为。 */
  get headPoint(): Vec2 {
    if (this.points && this.points.length > 0) {
      return this.points[this.points.length - 1];
    }
    return { x: this.x, y: this.y };
  }

  get moveDirection(): Direction {
    return this.dir;
  }

  get moveVector(): Vec2 {
    return DIR_VECTORS[this.moveDirection];
  }

  get bounds(): Rect {
    return arrowBounds(this);
  }

  toConfig(): ArrowConfig {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      dir: this.dir,
      type: this.type,
      layer: this.layer,
      bend: this.bend,
      points: this.points?.map((p) => ({ x: p.x, y: p.y })),
    };
  }
}

export class NormalArrow extends ArrowBase {
  constructor(config: ArrowConfig) {
    super(config, 'normal');
  }

  get movable(): boolean {
    return true;
  }
}

export class FixedArrow extends ArrowBase {
  constructor(config: ArrowConfig) {
    super(config, 'fixed');
  }

  get movable(): boolean {
    return false;
  }
}

export class ReverseArrow extends ArrowBase {
  constructor(config: ArrowConfig) {
    super(config, 'reverse');
  }

  get movable(): boolean {
    return true;
  }

  override get moveDirection(): Direction {
    return oppositeDirection(this.dir);
  }
}

export function createArrow(config: ArrowConfig): ArrowBase {
  switch (config.type ?? 'normal') {
    case 'fixed':
      return new FixedArrow(config);
    case 'reverse':
      return new ReverseArrow(config);
    case 'normal':
    default:
      return new NormalArrow(config);
  }
}
