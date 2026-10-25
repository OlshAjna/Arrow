import type { MoveCheck } from '../core/types';
import type { BlockedReason } from '../core/game-core';
import type { GameCore } from '../core/game-core';
import { CocosLocalStorage } from '../storage/CocosLocalStorage';
import { StorageManager } from '../storage/StorageManager';
import { LevelManager, type LevelSummary } from '../managers/LevelManager';
import { CocosJsonResourceLoader } from '../utils/JsonResourceLoader';

/**
 * 对局应用层入口。它连接关卡、纯逻辑核心和存档，但不负责节点绘制。
 */
export class GameManager {
    private static active: GameManager | null = null;

    private nextId: string | null = null;

    private constructor(private readonly levels: LevelManager) {}

    public static async create(): Promise<GameManager> {
        if (GameManager.active !== null) {
            return GameManager.active;
        }

        const storage = new StorageManager(new CocosLocalStorage());
        const levels = new LevelManager(storage, new CocosJsonResourceLoader());
        await levels.initialize();
        GameManager.active = new GameManager(levels);
        return GameManager.active;
    }

    public static get instance(): GameManager {
        if (GameManager.active === null) {
            throw new Error('GameManager 尚未创建');
        }
        return GameManager.active;
    }

    public async loadLevel(levelId?: string): Promise<GameCore> {
        const game = await this.levels.loadLevel(levelId);
        this.nextId = this.levels.nextLevelId;
        game.message = this.levels.currentLevel.order === 1
            ? '点击一条黑线，让它沿箭头方向离开棋盘。'
            : `第 ${this.levels.currentLevel.order} 关：寻找当前畅通的出口。`;
        return game;
    }

    public get game(): GameCore {
        return this.levels.game;
    }

    public get nextLevelId(): string | null {
        return this.nextId;
    }

    public get currentLevel(): LevelSummary {
        return this.levels.currentLevel;
    }

    public get unlockedLevels(): readonly LevelSummary[] {
        return this.levels.unlockedLevels;
    }

    public checkMove(arrowId: string): MoveCheck {
        return this.game.checkMove(arrowId);
    }

    public commitClear(arrowId: string): boolean {
        const wasPlaying = this.game.status === 'playing';
        const cleared = this.game.commitClear(arrowId);
        if (cleared && wasPlaying && this.game.status === 'won') {
            const stars = this.calculateStars();
            this.nextId = this.levels.completeCurrentLevel(stars);
            this.game.message = `${this.game.message} 获得 ${stars} 星`;
        }
        return cleared;
    }

    public registerBlocked(arrowId: string, reason: BlockedReason): void {
        this.game.registerBlocked(arrowId, reason);
    }

    public useHint(): string | null {
        return this.game.useHint();
    }

    public reset(): void {
        this.levels.resetCurrentLevel();
        this.game.message = '关卡已重置';
    }

    public async loadNextLevel(): Promise<GameCore | null> {
        if (this.nextId === null) {
            return null;
        }
        return this.loadLevel(this.nextId);
    }

    private calculateStars(): number {
        if (this.game.lives >= this.game.maxLife) {
            return 3;
        }
        return this.game.lives > 0 ? 2 : 1;
    }
}
