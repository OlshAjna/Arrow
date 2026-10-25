import { DIR_VECTORS, distanceToBoardEdge, pointInRect } from './math';
import { LONG_LINE_HALF_WIDTH, arrowBounds } from './geometry';
import type { ArrowBase } from './arrows';
import type { Direction, RayHit, Rect, Vec2, WallConfig } from './types';

const EPS = 1e-7;

/**
 * 射线与轴对齐包围盒（AABB）求交，返回最近正交点距离。
 * 使用 slab 算法，支持射线起点在盒内（返回 0）。
 */
export function rayAABB(origin: Vec2, dir: Vec2, rect: Rect): number | null {
  let tMin = 0;
  let tMax = Number.POSITIVE_INFINITY;

  const axes: Array<[number, number, number, number]> = [
    [origin.x, dir.x, rect.x, rect.x + rect.width],
    [origin.y, dir.y, rect.y, rect.y + rect.height],
  ];

  for (const [o, d, min, max] of axes) {
    if (Math.abs(d) < EPS) {
      if (o < min || o > max) return null;
      continue;
    }
    let t1 = (min - o) / d;
    let t2 = (max - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }

  return tMin;
}

/**
 * 从箭头锚点沿实际移动方向发射射线，收集墙体与其它箭头中最近的阻挡物。
 * 只检查到棋盘边界为止，边界本身不是阻挡。
 */
export function castRay(
  origin: Vec2,
  direction: Direction,
  boardWidth: number,
  boardHeight: number,
  walls: readonly WallConfig[],
  arrows: readonly ArrowBase[],
  excludeArrowId: string,
): RayHit | null {
  const dir = DIR_VECTORS[direction];
  const maxDistance = distanceToBoardEdge(origin, dir, boardWidth, boardHeight);
  let nearest: RayHit | null = null;

  const consider = (distance: number | null, targetId: string, targetKind: 'wall' | 'arrow') => {
    if (distance === null) return;
    if (distance < 0 || distance > maxDistance + EPS) return;
    if (!nearest || distance < nearest.distance) {
      nearest = { distance, targetId, targetKind };
    }
  };

  for (const wall of walls) {
    consider(rayAABB(origin, dir, wall), wall.id, 'wall');
  }

  for (const arrow of arrows) {
    if (!arrow.alive) continue;
    const isSelf = arrow.id === excludeArrowId;
    if (arrow.points && arrow.points.length >= 2) {
      // 长折线：逐段做“扩展 AABB”检测。路径均为正交线段，
      // 因此对水平/竖直段来说，扩展 AABB 与胶囊碰撞等价。
      // 自身也参与检测，但跳过与箭头尖端相连的最后一段，避免 t=0 自撞。
      for (let i = 0; i < arrow.points.length - 1; i += 1) {
        if (isSelf && i === arrow.points.length - 2) continue;
        const a = arrow.points[i];
        const b = arrow.points[i + 1];
        const rect: Rect = {
          x: Math.min(a.x, b.x) - LONG_LINE_HALF_WIDTH,
          y: Math.min(a.y, b.y) - LONG_LINE_HALF_WIDTH,
          width: Math.abs(a.x - b.x) + LONG_LINE_HALF_WIDTH * 2,
          height: Math.abs(a.y - b.y) + LONG_LINE_HALF_WIDTH * 2,
        };
        consider(rayAABB(origin, dir, rect), arrow.id, 'arrow');
      }
    } else if (!isSelf) {
      consider(rayAABB(origin, dir, arrowBounds(arrow)), arrow.id, 'arrow');
    }
  }

  return nearest;
}

/** 点击命中辅助：返回包围盒命中的箭头（供需要矩形筛选的场景使用）。 */
export function pointInsideArrowBounds(point: Vec2, arrow: ArrowBase): boolean {
  return pointInRect(point, arrowBounds(arrow));
}
