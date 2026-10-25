/**
 * 《益智箭》迭代三 · 核心类型定义
 * 职责：只描述数据，不依赖 Cocos Creator 或浏览器。
 */

export type Direction = 'up' | 'right' | 'down' | 'left';
export type ArrowType = 'normal' | 'fixed' | 'reverse';
export type GameStatus = 'playing' | 'won' | 'lost';

export interface Vec2 {
  x: number;
  y: number;
}

/** 轴对齐矩形，x/y 为左上角，坐标系 y 向下。 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ArrowConfig {
  id: string;
  /** 箭头锚点（几何中心附近），棋盘逻辑坐标。 */
  x: number;
  y: number;
  /** 箭头外观朝向；ReverseArrow 的实际移动方向与它相反。 */
  dir: Direction;
  type?: ArrowType;
  /** 渲染层级，值越大越靠前；也用于点击命中排序。 */
  layer?: number;
  /** 折线弯曲方向：-1 / 0 / 1，仅影响短箭头外观与碰撞盒。 */
  bend?: -1 | 0 | 1;
  /**
   * 可选：完整折线中心线（棋盘坐标，按尾 → 头排序）。
   * 提供时使用任意长度的正交折线；最后一点为箭头尖端。
   */
  points?: Vec2[];
}

export interface WallConfig {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LevelConfig {
  id: string;
  name: string;
  width: number;
  height: number;
  lives: number;
  hints: number;
  arrows: ArrowConfig[];
  walls: WallConfig[];
}

export interface RayHit {
  /** 从射线起点到碰撞点的距离。 */
  distance: number;
  targetId: string;
  targetKind: 'wall' | 'arrow';
}

export type MoveKind = 'clear' | 'blocked' | 'fixed';

export interface MoveCheck {
  kind: MoveKind;
  arrowId: string;
  direction: Direction;
  /** clear：到出界点的距离；blocked：到阻挡物的距离；fixed：0。 */
  distance: number;
  hit?: RayHit;
}

export interface GameSnapshot {
  status: GameStatus;
  lives: number;
  maxLives: number;
  hints: number;
  remainingMovable: number;
  totalMovable: number;
  message: string;
}
