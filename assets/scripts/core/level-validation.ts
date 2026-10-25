import { arrowBounds } from './geometry';
import { rectsOverlap } from './math';
import type { LevelConfig } from './types';

export class LevelValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LevelValidationError';
  }
}

/**
 * 关卡配置校验：在进入对局前尽早失败，避免运行期出现负生命、重复 id、
 * 箭头在墙里等不可恢复状态。
 */
export function validateLevel(level: LevelConfig): void {
  if (!level || typeof level !== 'object') throw new LevelValidationError('关卡配置为空');
  if (!level.id) throw new LevelValidationError('level.id 不能为空');
  if (!Number.isFinite(level.width) || level.width <= 0) throw new LevelValidationError('level.width 必须大于 0');
  if (!Number.isFinite(level.height) || level.height <= 0) throw new LevelValidationError('level.height 必须大于 0');
  if (!Number.isInteger(level.lives) || level.lives <= 0) throw new LevelValidationError('lives 必须为正整数');
  if (!Number.isInteger(level.hints) || level.hints < 0) throw new LevelValidationError('hints 不能为负数');
  if (!Array.isArray(level.arrows) || level.arrows.length === 0) throw new LevelValidationError('至少需要一支箭头');

  const ids = new Set<string>();
  const registerId = (id: string) => {
    if (!id) throw new LevelValidationError('id 不能为空');
    if (ids.has(id)) throw new LevelValidationError(`重复 id：${id}`);
    ids.add(id);
  };

  let movableCount = 0;
  for (const arrow of level.arrows) {
    registerId(arrow.id);
    if (!Number.isFinite(arrow.x) || !Number.isFinite(arrow.y)) {
      throw new LevelValidationError(`${arrow.id} 坐标非法`);
    }
    if (arrow.x < 0 || arrow.x > level.width || arrow.y < 0 || arrow.y > level.height) {
      throw new LevelValidationError(`${arrow.id} 锚点超出棋盘`);
    }
    if (!['up', 'right', 'down', 'left'].includes(arrow.dir)) {
      throw new LevelValidationError(`${arrow.id} 方向非法`);
    }
    if (arrow.type && !['normal', 'fixed', 'reverse'].includes(arrow.type)) {
      throw new LevelValidationError(`${arrow.id} 类型非法`);
    }
    if (arrow.bend !== undefined && ![-1, 0, 1].includes(arrow.bend)) {
      throw new LevelValidationError(`${arrow.id} bend 必须为 -1/0/1`);
    }
    if (arrow.points) {
      if (arrow.points.length < 2) {
        throw new LevelValidationError(`${arrow.id} 折线至少需要 2 个点`);
      }
      for (const point of arrow.points) {
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)
          || point.x < 0 || point.x > level.width
          || point.y < 0 || point.y > level.height) {
          throw new LevelValidationError(`${arrow.id} 折线点超出棋盘`);
        }
      }
    }
    if ((arrow.type ?? 'normal') !== 'fixed') movableCount += 1;
  }

  for (const wall of level.walls ?? []) {
    registerId(wall.id);
    if (!Number.isFinite(wall.x) || !Number.isFinite(wall.y)
      || !Number.isFinite(wall.width) || !Number.isFinite(wall.height)
      || wall.width <= 0 || wall.height <= 0) {
      throw new LevelValidationError(`${wall.id} 墙体尺寸非法`);
    }
    if (wall.x < 0 || wall.y < 0
      || wall.x + wall.width > level.width
      || wall.y + wall.height > level.height) {
      throw new LevelValidationError(`${wall.id} 墙体超出棋盘`);
    }
    for (const arrow of level.arrows) {
      if (arrow.x >= wall.x && arrow.x <= wall.x + wall.width
        && arrow.y >= wall.y && arrow.y <= wall.y + wall.height) {
        throw new LevelValidationError(`${arrow.id} 锚点落在墙体 ${wall.id} 内`);
      }
      if (rectsOverlap(arrowBounds(arrow), wall)) {
        throw new LevelValidationError(`${arrow.id} 的碰撞盒与墙体 ${wall.id} 重叠`);
      }
    }
  }

  if (movableCount === 0) {
    throw new LevelValidationError('至少需要一支可移动箭头，否则开局即胜利');
  }
}
