import { GameCore } from '../core/game-core';
import { validateLevel } from '../core/level-validation';
import type { LevelConfig } from '../core/types';
import type { LevelProgress } from '../storage/SaveData';
import { StorageManager } from '../storage/StorageManager';
import type { JsonAssetLoader } from '../utils/JsonResourceLoader';

export interface LevelSummary {
    levelId: string;
    order: number;
    name: string;
    resource: string;
}

export interface LevelManifest {
    version: number;
    levels: LevelSummary[];
}

export class LevelManager {
    private static readonly MANIFEST_PATH = 'levels/level-manifest';

    private manifest: LevelManifest | null = null;
    private currentGame: GameCore | null = null;
    private currentSummary: LevelSummary | null = null;

    public constructor(
        private readonly storage: StorageManager,
        private readonly loader: JsonAssetLoader,
    ) {}

    public async initialize(): Promise<void> {
        if (this.manifest !== null) {
            return;
        }

        const raw = await this.loader.load<unknown>(LevelManager.MANIFEST_PATH);
        this.manifest = this.parseManifest(raw);
    }

    public async loadLevel(levelId?: string): Promise<GameCore> {
        await this.initialize();
        const summary = levelId === undefined
            ? this.getInitialSummary()
            : this.requireSummary(levelId);

        if (!this.storage.isOrderUnlocked(summary.order)) {
            throw new Error(`关卡 ${summary.name} 尚未解锁`);
        }

        const config = await this.loader.load<LevelConfig>(summary.resource);
        validateLevel(config);
        if (config.id !== summary.levelId) {
            throw new Error(
                `关卡清单中的 ${summary.levelId} 与配置中的 ${config.id} 不一致`,
            );
        }

        this.currentGame = new GameCore(config);
        this.currentSummary = summary;
        return this.currentGame;
    }

    public resetCurrentLevel(): GameCore {
        if (this.currentGame === null) {
            throw new Error('尚未加载关卡');
        }
        this.currentGame.reset();
        return this.currentGame;
    }

    public get game(): GameCore {
        if (this.currentGame === null) {
            throw new Error('尚未加载关卡');
        }
        return this.currentGame;
    }

    public get currentLevel(): LevelSummary {
        if (this.currentSummary === null) {
            throw new Error('尚未加载关卡');
        }
        return { ...this.currentSummary };
    }

    public completeCurrentLevel(stars: number): string | null {
        const current = this.currentLevel;
        this.storage.recordLevelCompletion(current.levelId, stars);
        const next = this.getNextSummary(current);
        if (next !== null) {
            this.storage.setMaxUnlockedOrder(next.order);
            return next.levelId;
        }
        return null;
    }

    public isLevelUnlocked(levelId: string): boolean {
        const summary = this.manifest?.levels.find((item) => item.levelId === levelId);
        return summary !== undefined && this.storage.isOrderUnlocked(summary.order);
    }

    public getLevelProgress(levelId: string): LevelProgress | null {
        return this.storage.getLevelProgress(levelId);
    }

    public get nextLevelId(): string | null {
        if (this.currentSummary === null) {
            return null;
        }
        return this.getNextSummary(this.currentSummary)?.levelId ?? null;
    }

    public get unlockedLevels(): readonly LevelSummary[] {
        if (this.manifest === null) {
            return [];
        }
        return this.manifest.levels
            .filter((summary) => this.storage.isOrderUnlocked(summary.order))
            .map((summary) => ({ ...summary }));
    }

    private getInitialSummary(): LevelSummary {
        const unlocked = this.unlockedLevels;
        const summary = unlocked[unlocked.length - 1] ?? this.requireManifest().levels[0];
        if (summary === undefined) {
            throw new Error('关卡清单为空');
        }
        return summary;
    }

    private getNextSummary(current: LevelSummary): LevelSummary | null {
        return this.requireManifest().levels.find((item) => item.order > current.order) ?? null;
    }

    private requireSummary(levelId: string): LevelSummary {
        const summary = this.requireManifest().levels.find((item) => item.levelId === levelId);
        if (summary === undefined) {
            throw new Error(`未知关卡 ${levelId}`);
        }
        return summary;
    }

    private requireManifest(): LevelManifest {
        if (this.manifest === null) {
            throw new Error('关卡管理器尚未初始化');
        }
        return this.manifest;
    }

    private parseManifest(value: unknown): LevelManifest {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            throw new Error('关卡清单格式错误');
        }

        const record = value as Record<string, unknown>;
        if (!Array.isArray(record.levels) || record.levels.length === 0) {
            throw new Error('关卡清单必须包含 levels 数组');
        }

        const ids = new Set<string>();
        const orders = new Set<number>();
        const levels = record.levels.map((entry, index) => {
            if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
                throw new Error(`levels[${index}] 格式错误`);
            }

            const item = entry as Record<string, unknown>;
            const levelId = this.requiredString(item.levelId, `levels[${index}].levelId`);
            const order = this.requiredPositiveInteger(item.order, `levels[${index}].order`);
            const summary: LevelSummary = {
                levelId,
                order,
                name: this.requiredString(item.name, `levels[${index}].name`),
                resource: this.requiredString(item.resource, `levels[${index}].resource`),
            };

            if (ids.has(levelId) || orders.has(order)) {
                throw new Error(`关卡清单存在重复 ID 或顺序：${levelId}`);
            }
            ids.add(levelId);
            orders.add(order);
            return summary;
        });

        return {
            version: this.optionalPositiveInteger(record.version, 1),
            levels: levels.sort((left, right) => left.order - right.order),
        };
    }

    private requiredString(value: unknown, field: string): string {
        if (typeof value !== 'string' || value.trim() === '') {
            throw new Error(`${field} 必须是非空字符串`);
        }
        return value.trim();
    }

    private requiredPositiveInteger(value: unknown, field: string): number {
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
            throw new Error(`${field} 必须是正整数`);
        }
        return value;
    }

    private optionalPositiveInteger(value: unknown, fallback: number): number {
        return value === undefined ? fallback : this.requiredPositiveInteger(value, 'version');
    }
}
