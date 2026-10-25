import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GameCore,
  LevelValidationError,
  rayAABB,
  validateLevel,
} from '../assets/scripts/core/index.ts';
import type {
  ArrowConfig,
  ArrowType,
  Direction,
  LevelConfig,
} from '../assets/scripts/core/types.ts';

const testRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const readLevel = (name: string): LevelConfig => JSON.parse(
  readFileSync(path.join(testRoot, `assets/resources/levels/${name}.json`), 'utf8'),
) as LevelConfig;
const SHORT_LEVEL = readLevel('level-001');
const DEMO_LEVEL = readLevel('level-002');

const arrow = (
  id: string,
  x: number,
  y: number,
  dir: Direction = 'right',
  type: ArrowType = 'normal',
  bend: -1 | 0 | 1 = 0,
  layer = 1,
): ArrowConfig => ({
  id,
  x,
  y,
  dir,
  type,
  bend,
  layer,
});

const makeLevel = (overrides: Partial<LevelConfig> = {}): LevelConfig => ({
  id: 'test',
  name: 'test',
  width: 600,
  height: 600,
  lives: 3,
  hints: 1,
  arrows: [arrow('a1', 100, 250)],
  walls: [],
  ...overrides,
});

test('rayAABB：命中、错过、平行、起点在盒内', () => {
  const rect = { x: 100, y: 0, width: 20, height: 20 };
  assert.equal(rayAABB({ x: 0, y: 10 }, { x: 1, y: 0 }, rect), 100);
  assert.equal(rayAABB({ x: 0, y: 50 }, { x: 1, y: 0 }, rect), null);
  assert.equal(rayAABB({ x: 0, y: 30 }, { x: 1, y: 0 }, { x: 0, y: 0, width: 20, height: 10 }), null);
  assert.equal(rayAABB({ x: 105, y: 10 }, { x: 0, y: 1 }, rect), 0);
});

test('畅通：移除后棋盘为空并胜利', () => {
  const core = new GameCore(makeLevel());
  const result = core.checkMove('a1');
  assert.equal(result.kind, 'clear');
  assert.ok(result.distance > 0);
  assert.equal(core.remainingMovable, 1);
  assert.equal(core.commitClear('a1'), true);
  assert.equal(core.status, 'won');
  assert.equal(core.remainingMovable, 0);
});

test('墙体阻挡：返回墙体 id，棋盘不变，扣生命', () => {
  const core = new GameCore(makeLevel({
    arrows: [arrow('a1', 100, 250)],
    walls: [{ id: 'w1', x: 300, y: 200, width: 24, height: 100 }],
  }));
  const before = core.snapshot();
  const result = core.checkMove('a1');
  assert.equal(result.kind, 'blocked');
  assert.equal(result.hit?.targetId, 'w1');
  assert.equal(result.hit?.targetKind, 'wall');
  assert.ok(result.distance > 0);

  core.registerBlocked('a1', { type: 'blocked', blockerId: 'w1' });
  assert.equal(core.lives, 2);
  assert.equal(core.remainingMovable, before.remainingMovable);
  assert.equal(core.getArrow('a1')?.x, 100);
  assert.equal(core.getArrow('a1')?.y, 250);
});

test('线条阻挡：最近箭头成为 blocker', () => {
  const core = new GameCore(makeLevel({
    arrows: [
      arrow('a1', 100, 250),
      arrow('a2', 300, 250),
    ],
  }));
  const result = core.checkMove('a1');
  assert.equal(result.kind, 'blocked');
  assert.equal(result.hit?.targetId, 'a2');
  assert.equal(result.hit?.targetKind, 'arrow');
});

test('反转箭头：外观朝右，实际向左移动', () => {
  const core = new GameCore(makeLevel({
    arrows: [arrow('a1', 300, 250, 'right', 'reverse')],
  }));
  const result = core.checkMove('a1');
  assert.equal(result.kind, 'clear');
  assert.equal(result.direction, 'left');
  core.commitClear('a1');
  assert.equal(core.status, 'won');
});

test('固定箭头：不可移动，点击扣生命', () => {
  const core = new GameCore(makeLevel({
    arrows: [arrow('a1', 100, 100), arrow('fix', 400, 400, 'up', 'fixed')],
    walls: [],
  }));
  const result = core.checkMove('fix');
  assert.equal(result.kind, 'fixed');
  assert.equal(result.distance, 0);
  core.registerBlocked('fix', { type: 'fixed' });
  assert.equal(core.lives, 2);
  assert.equal(core.remainingMovable, 1);
});

test('胜利只统计可移动箭头，固定箭头可以留在场上', () => {
  const core = new GameCore(makeLevel({
    arrows: [arrow('a1', 100, 100), arrow('fix', 450, 450, 'up', 'fixed')],
  }));
  assert.equal(core.totalMovable, 1);
  core.commitClear('a1');
  assert.equal(core.status, 'won');
  assert.equal(core.getArrow('fix')?.alive, true);
});

test('生命耗尽判负', () => {
  const core = new GameCore(makeLevel({
    lives: 1,
    arrows: [arrow('a1', 100, 250)],
    walls: [{ id: 'w1', x: 300, y: 200, width: 24, height: 100 }],
  }));
  core.registerBlocked('a1', { type: 'blocked', blockerId: 'w1' });
  assert.equal(core.lives, 0);
  assert.equal(core.status, 'lost');
  core.registerBlocked('a1', { type: 'blocked', blockerId: 'w1' });
  assert.equal(core.lives, 0);
});

test('重置恢复箭头、生命、提示与状态', () => {
  const core = new GameCore(makeLevel({
    lives: 2,
    hints: 2,
    arrows: [arrow('a1', 100, 250)],
  }));
  core.commitClear('a1');
  assert.equal(core.status, 'won');
  core.reset();
  assert.equal(core.status, 'playing');
  assert.equal(core.lives, 2);
  assert.equal(core.hints, 2);
  assert.equal(core.remainingMovable, 1);
  assert.equal(core.getArrow('a1')?.alive, true);
});

test('提示只返回可立即消除的箭头，并消耗一次', () => {
  const core = new GameCore(makeLevel({
    hints: 1,
    arrows: [arrow('blocked', 100, 250), arrow('clear', 100, 100)],
    walls: [{ id: 'w1', x: 300, y: 200, width: 24, height: 100 }],
  }));
  const hint = core.useHint();
  assert.equal(hint, 'clear');
  assert.equal(core.hints, 0);
  assert.equal(core.useHint(), null);
});

test('无直接可消除箭头时，提示不消耗次数', () => {
  const core = new GameCore(makeLevel({
    hints: 1,
    arrows: [arrow('a1', 100, 250)],
    walls: [{ id: 'w1', x: 300, y: 200, width: 24, height: 100 }],
  }));
  assert.equal(core.useHint(), null);
  assert.equal(core.hints, 1);
});

test('非法输入与非法状态抛出错误', () => {
  const core = new GameCore(makeLevel());
  assert.throws(() => core.checkMove('missing'), /ARROW_NOT_FOUND/);
  core.commitClear('a1');
  assert.throws(() => core.checkMove('a1'), /GAME_NOT_PLAYING/);
});

test('关卡校验：重复 id、无移动箭头、箭头压墙', () => {
  assert.throws(() => validateLevel(makeLevel({
    arrows: [arrow('same', 100, 100), arrow('same', 200, 200)],
  })), LevelValidationError);

  assert.throws(() => validateLevel(makeLevel({
    arrows: [arrow('fix', 100, 100, 'up', 'fixed')],
  })), /至少需要一支可移动箭头/);

  assert.throws(() => validateLevel(makeLevel({
    arrows: [arrow('a1', 100, 100)],
    walls: [{ id: 'w1', x: 120, y: 80, width: 120, height: 60 }],
  })), /碰撞盒与墙体/);
});

test('短箭头回归关卡存在完整可解序列', () => {
  const core = new GameCore(SHORT_LEVEL);
  const order = ['a2', 'a3', 'a5', 'a4', 'a1', 'a6', 'a7', 'a9'];
  for (const id of order) {
    const result = core.checkMove(id);
    assert.equal(result.kind, 'clear', `${id} 应该可以消除，实际 ${result.kind}`);
    assert.equal(core.commitClear(id), true);
  }
  assert.equal(core.status, 'won');
  assert.equal(core.lives, 3);
  assert.equal(core.remainingMovable, 0);
});

test('短箭头回归关初始状态同时存在可消除与被阻挡箭头', () => {
  const core = new GameCore(SHORT_LEVEL);
  assert.equal(core.checkMove('a2').kind, 'clear');
  assert.equal(core.checkMove('a1').kind, 'blocked');
  assert.equal(core.checkMove('a8').kind, 'fixed');
});


test('长线迷宫关卡：24 支长折线，初始有畅通和受阻分支，且可完整通关', () => {
  const core = new GameCore(DEMO_LEVEL);
  assert.equal(core.getArrows().length, 24);
  assert.equal(core.totalMovable, 24);

  const initialKinds = core.getArrows().map((a) => core.checkMove(a.id).kind);
  assert.ok(initialKinds.includes('clear'));
  assert.ok(initialKinds.includes('blocked'));
  for (const arrow of core.getArrows()) {
    const result = core.checkMove(arrow.id);
    assert.notEqual(result.hit?.targetId, arrow.id, `${arrow.id} 不应被自身堵死`);
  }

  let guard = 0;
  while (core.status === 'playing' && guard < 80) {
    guard += 1;
    const next = core.getArrows().find((a) => a.alive && a.movable && core.checkMove(a.id).kind === 'clear');
    if (!next) break;
    core.commitClear(next.id);
  }
  assert.equal(core.status, 'won');
  assert.equal(core.remainingMovable, 0);
});


test('线条自身的折返可以阻挡自己，用于暴露自堵关卡', () => {
  const selfBlocking: ArrowConfig = {
    id: 'self',
    x: 100, y: 100, dir: 'right', type: 'normal', layer: 1,
    points: [
      { x: 300, y: 100 },
      { x: 300, y: 300 },
      { x: 50, y: 300 },
      { x: 50, y: 100 },
      { x: 100, y: 100 },
    ],
  };
  const core = new GameCore(makeLevel({ arrows: [selfBlocking] }));
  const result = core.checkMove('self');
  assert.equal(result.kind, 'blocked');
  assert.equal(result.hit?.targetId, 'self');
});
