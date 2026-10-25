import { GameCore } from './game-core';
import { validateLevel } from './level-validation';
import type { LevelConfig } from './types';

export interface LevelSource {
  load(levelId: string): Promise<LevelConfig>;
}

/** Demo / 单测使用的静态关卡源；真实工程可替换为 JSON/远程配置服务。 */
export class StaticLevelSource implements LevelSource {
  private readonly levels: Map<string, LevelConfig>;

  constructor(levels: LevelConfig[]) {
    this.levels = new Map(levels.map((level) => [level.id, level]));
  }

  async load(levelId: string): Promise<LevelConfig> {
    const level = this.levels.get(levelId);
    if (!level) throw new Error(`LEVEL_NOT_FOUND:${levelId}`);
    return level;
  }
}

/**
 * 关卡管理适配层：负责“取配置 → 校验 → 创建 GameCore”。
 * 杜泽阳的 LevelManager 可在内部复用本类，或把 LevelSource 换成真实实现。
 */
export class LevelManager {
  private current: GameCore | null = null;

  constructor(private readonly source: LevelSource) {}

  async loadLevel(levelId: string): Promise<GameCore> {
    const config = await this.source.load(levelId);
    validateLevel(config);
    this.current = new GameCore(config);
    return this.current;
  }

  get currentGame(): GameCore | null {
    return this.current;
  }
}
