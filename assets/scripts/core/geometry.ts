import { DIR_ANGLE, rotatePoint } from './math';
import type { ArrowConfig, Direction, Rect, Vec2 } from './types';

export interface ArrowGeometry {
  /** 折线箭杆，按顺序连成 polyline。 */
  shaft: Vec2[];
  /** 三角箭头。 */
  head: Vec2[];
}

export interface ArrowLike {
  x: number;
  y: number;
  dir: Direction;
  bend?: number;
  points?: readonly Vec2[];
}

const HEAD_BASE_X = 6;
const HEAD_TIP_X = 48;
const HEAD_HALF_HEIGHT = 20;
const SHAFT_HALF_WIDTH = 10;
export const LONG_LINE_HALF_WIDTH = 9;

export function localArrowGeometry(bend: number = 0): ArrowGeometry {
  const shaft: Vec2[] = bend > 0
    ? [
        { x: -52, y: 16 },
        { x: -28, y: 16 },
        { x: -28, y: 0 },
        { x: HEAD_BASE_X, y: 0 },
      ]
    : bend < 0
      ? [
          { x: -52, y: -16 },
          { x: -28, y: -16 },
          { x: -28, y: 0 },
          { x: HEAD_BASE_X, y: 0 },
        ]
      : [
          { x: -52, y: 0 },
          { x: HEAD_BASE_X, y: 0 },
        ];

  return {
    shaft,
    head: [
      { x: HEAD_BASE_X, y: -HEAD_HALF_HEIGHT },
      { x: HEAD_TIP_X, y: 0 },
      { x: HEAD_BASE_X, y: HEAD_HALF_HEIGHT },
    ],
  };
}

export function worldArrowGeometry(arrow: ArrowLike): ArrowGeometry {
  const angle = DIR_ANGLE[arrow.dir];
  const rotate = (p: Vec2): Vec2 => {
    const r = rotatePoint(p, angle);
    return { x: arrow.x + r.x, y: arrow.y + r.y };
  };
  const local = localArrowGeometry(arrow.bend ?? 0);
  return {
    shaft: local.shaft.map(rotate),
    head: local.head.map(rotate),
  };
}

export function polylineBounds(points: readonly Vec2[], padding: number = 4): Rect {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

export function polylineLength(points: readonly Vec2[]): number {
  let length = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    length += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  }
  return length;
}

/**
 * 从折线起点开始裁掉 distance 长度的“绳子”：
 * 返回新的折线（起点为裁切点，之后保留原折线剩余顶点）。
 * 用于“箭头飞出、线条像绳子一样沿原路径收回”的动画。
 */
export function trimPolylineStart(points: readonly Vec2[], distance: number): Vec2[] {
  if (points.length < 2) return points.map((p) => ({ x: p.x, y: p.y }));
  if (distance <= 0) return points.map((p) => ({ x: p.x, y: p.y }));

  let remaining = distance;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const segmentLength = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining < segmentLength) {
      const t = remaining / segmentLength;
      const start: Vec2 = {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      };
      return [start, ...points.slice(i + 1).map((p) => ({ x: p.x, y: p.y }))];
    }
    remaining -= segmentLength;
  }

  const last = points[points.length - 1];
  return [{ x: last.x, y: last.y }];
}

/**
 * 取折线 [start, end] 距离区间内的一段，两端做线性插值。
 * 用于整条线沿原路径“滑动”飞出：线段长度保持不变，箭头始终在段首。
 */
export function slicePolyline(points: readonly Vec2[], start: number, end: number): Vec2[] {
  if (points.length < 2) return points.map((p) => ({ x: p.x, y: p.y }));
  const total = polylineLength(points);
  const from = Math.max(0, Math.min(start, total));
  const to = Math.max(from, Math.min(end, total));
  if (to - from < 1e-6) {
    const p = trimPolylineStart(points, from)[0];
    return [{ x: p.x, y: p.y }];
  }

  const result: Vec2[] = [];
  let traveled = 0;
  const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  });

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const segmentLength = Math.hypot(b.x - a.x, b.y - a.y);
    if (segmentLength <= 1e-9) continue;
    const segmentStart = traveled;
    const segmentEnd = traveled + segmentLength;
    traveled = segmentEnd;
    if (segmentEnd <= from || segmentStart >= to) continue;

    if (result.length === 0) {
      const t = (from - segmentStart) / segmentLength;
      result.push(lerp(a, b, Math.max(0, Math.min(1, t))));
    }
    if (to <= segmentEnd) {
      const t = (to - segmentStart) / segmentLength;
      const endPoint = lerp(a, b, Math.max(0, Math.min(1, t)));
      const last = result[result.length - 1];
      if (Math.hypot(endPoint.x - last.x, endPoint.y - last.y) > 1e-6) result.push(endPoint);
      break;
    }
    if (segmentEnd < to) {
      const last = result[result.length - 1];
      if (Math.hypot(b.x - last.x, b.y - last.y) > 1e-6) result.push({ x: b.x, y: b.y });
    }
  }
  return result;
}

export function arrowBounds(arrow: ArrowLike, padding: number = 4): Rect {
  if (arrow.points && arrow.points.length >= 2) {
    return polylineBounds(arrow.points, padding + LONG_LINE_HALF_WIDTH);
  }

  const geometry = worldArrowGeometry(arrow);
  const points = [...geometry.shaft, ...geometry.head];
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

export function pointInPolygon(point: Vec2, polygon: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects = (a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || 1e-9) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function distanceToSegment(point: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

/**
 * 精确点击命中：把点逆旋转到箭头局部坐标，
 * 再判断“箭杆线段附近”或“箭头三角形内部”。
 */
export function hitTestArrow(point: Vec2, arrow: ArrowLike): boolean {
  if (arrow.points && arrow.points.length >= 2) {
    for (let i = 0; i < arrow.points.length - 1; i += 1) {
      if (distanceToSegment(point, arrow.points[i], arrow.points[i + 1]) <= LONG_LINE_HALF_WIDTH) {
        return true;
      }
    }
    return false;
  }

  const angle = -DIR_ANGLE[arrow.dir];
  const localPoint = rotatePoint(
    { x: point.x - arrow.x, y: point.y - arrow.y },
    angle,
  );
  const geometry = localArrowGeometry(arrow.bend ?? 0);
  if (pointInPolygon(localPoint, geometry.head)) return true;
  for (let i = 0; i < geometry.shaft.length - 1; i += 1) {
    if (distanceToSegment(localPoint, geometry.shaft[i], geometry.shaft[i + 1]) <= SHAFT_HALF_WIDTH) {
      return true;
    }
  }
  return false;
}

export function arrowVisualCenter(arrow: ArrowLike): Vec2 {
  return { x: arrow.x - 6, y: arrow.y };
}

/** 该箭头在“实际移动方向”上的单位向量，供表现层做位移。 */
export function moveVector(direction: Direction): Vec2 {
  switch (direction) {
    case 'up':
      return { x: 0, y: -1 };
    case 'down':
      return { x: 0, y: 1 };
    case 'left':
      return { x: -1, y: 0 };
    case 'right':
      return { x: 1, y: 0 };
  }
}

export function arrowConfigBounds(config: ArrowConfig): Rect {
  return arrowBounds(config);
}
