import type { Direction, Rect, Vec2 } from './types';

export const DIR_VECTORS: Record<Direction, Vec2> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

export const DIR_ANGLE: Record<Direction, number> = {
  right: 0,
  down: Math.PI / 2,
  left: Math.PI,
  up: -Math.PI / 2,
};

export function oppositeDirection(dir: Direction): Direction {
  switch (dir) {
    case 'up':
      return 'down';
    case 'down':
      return 'up';
    case 'left':
      return 'right';
    case 'right':
      return 'left';
  }
}

export function rotatePoint(point: Vec2, angle: number): Vec2 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

export function rectLeft(rect: Rect): number {
  return rect.x;
}

export function rectRight(rect: Rect): number {
  return rect.x + rect.width;
}

export function rectTop(rect: Rect): number {
  return rect.y;
}

export function rectBottom(rect: Rect): number {
  return rect.y + rect.height;
}

export function pointInRect(point: Vec2, rect: Rect): boolean {
  return point.x >= rect.x
    && point.x <= rect.x + rect.width
    && point.y >= rect.y
    && point.y <= rect.y + rect.height;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

export function expandRect(rect: Rect, padding: number): Rect {
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
}

/** 从 origin 沿 dir 到棋盘边界的距离；dir 必须是单位方向向量。 */
export function distanceToBoardEdge(
  origin: Vec2,
  dir: Vec2,
  boardWidth: number,
  boardHeight: number,
): number {
  let distance = Number.POSITIVE_INFINITY;
  if (dir.x > 0) distance = Math.min(distance, (boardWidth - origin.x) / dir.x);
  if (dir.x < 0) distance = Math.min(distance, origin.x / -dir.x);
  if (dir.y > 0) distance = Math.min(distance, (boardHeight - origin.y) / dir.y);
  if (dir.y < 0) distance = Math.min(distance, origin.y / -dir.y);
  return Math.max(0, distance);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
