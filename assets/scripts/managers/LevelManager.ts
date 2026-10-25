import { NormalArrow } from '../core/arrows/NormalArrow';
import { FixedArrow } from '../core/arrows/FixedArrow';
import { ReverseArrow } from '../core/arrows/ReverseArrow';
import type { ArrowBase } from '../core/ArrowBase';
import { Block } from '../core/Block';
import { CollisionDetector } from '../core/CollisionDetector';
import { GridPoint } from '../core/GridPoint';
import {
    LevelConfigParser,
    type ArrowConfig,
    type LevelConfig,
    type LevelManifest,
    type LevelSummary,
} from '../levels/LevelConfig';
import { StorageManager } from '../storage/StorageManager';
import { CocosJsonResourceLoader, type JsonAssetLoader } from '../utils/JsonResourceLoader';

export interface LevelRuntime {
    config: LevelConfig;
    arrows: ArrowBase[];
    blocks: Block[];
}

export class LevelManager {
    private static readonly MANIFEST_PATH = 'levels/level-manifest';

    private manifest: LevelManifest | null = null;
    private runtime: LevelRuntime | null = null;
    private currentSummary: LevelSummary | null = null;

    public constructor(
        private readonly storage: StorageManager,
        private readonly loader: JsonAssetLoader = new CocosJsonResourceLoader(),
    ) {}

    public async initialize(): Promise<LevelSummary[]> {
        if (this.manifest !== null) {
            return this.unlockedSummaries();
        }

        const raw = await this.loader.load<unknown>(LevelManager.MANIFEST_PATH);
        this.manifest = LevelConfigParser.parseManifest(raw);
        return this.unlockedSummaries();
    }

    public async loadLevel(levelId?: string): Promise<LevelRuntime> {
        await this.initialize();
        const summary = levelId === undefined
            ? this.findInitialSummary()
            : this.requireSummary(levelId);

        if (!this.storage.isOrderUnlocked(summary.order)) {
            throw new Error(`Level "${summary.levelId}" is locked.`);
        }

        const raw = await this.loader.load<unknown>(summary.resource);
        const config = LevelConfigParser.parseLevel(raw);
        if (config.id !== summary.levelId || config.order !== summary.order) {
            throw new Error(
                `Manifest entry "${summary.levelId}" does not match resource metadata.`,
            );
        }

        this.currentSummary = summary;
        this.runtime = this.createRuntime(config);
        return this.runtime;
    }

    public resetCurrentLevel(): LevelRuntime {
        if (this.runtime === null) {
            throw new Error('No level is currently loaded.');
        }
        this.runtime = this.createRuntime(this.runtime.config);
        return this.runtime;
    }

    public get current(): LevelRuntime {
        if (this.runtime === null) {
            throw new Error('No level is currently loaded.');
        }
        return this.runtime;
    }

    public get currentLevelSummary(): LevelSummary | null {
        return this.currentSummary === null ? null : { ...this.currentSummary };
    }

    public get unlockedLevels(): readonly LevelSummary[] {
        if (this.manifest === null) {
            return [];
        }
        return this.manifest.levels
            .filter((summary) => this.storage.isOrderUnlocked(summary.order))
            .map((summary) => ({ ...summary }));
    }

    public isLevelUnlocked(levelId: string): boolean {
        const summary = this.manifest?.levels.find((item) => item.levelId === levelId);
        return summary !== undefined && this.storage.isOrderUnlocked(summary.order);
    }

    public getHintArrowId(): string | null {
        const runtime = this.current;
        const arrow = CollisionDetector.findMovableArrow(
            runtime.arrows,
            runtime.blocks,
            runtime.config,
        );
        return arrow?.id ?? null;
    }

    public completeCurrentLevel(stars: number): string | null {
        const runtime = this.current;
        const summary = this.requireCurrentSummary();
        this.storage.recordLevelCompletion(runtime.config.id, stars);

        const next = this.getNextSummary(summary);
        if (next !== null) {
            this.storage.setMaxUnlockedOrder(next.order);
            return next.levelId;
        }
        return null;
    }

    public getMovableArrowCount(runtime: LevelRuntime = this.current): number {
        return runtime.arrows.filter(
            (arrow) => !arrow.isRemoved() && arrow.getMoveDirection() !== null,
        ).length;
    }

    private createRuntime(config: LevelConfig): LevelRuntime {
        return {
            config,
            arrows: config.arrows.map((arrow) => this.createArrow(arrow)),
            blocks: config.walls.map((wall) => new Block(wall)),
        };
    }

    private createArrow(config: ArrowConfig): ArrowBase {
        const data = {
            id: config.id,
            displayDirection: config.direction,
            body: config.body.map((point) => GridPoint.from(point)),
            drawOrder: config.drawOrder,
        };

        switch (config.kind) {
            case 'normal':
                return new NormalArrow(data);
            case 'fixed':
                return new FixedArrow(data);
            case 'reverse':
                return new ReverseArrow(data);
        }
    }

    private findInitialSummary(): LevelSummary {
        const unlocked = this.unlockedSummaries();
        const summary = unlocked[unlocked.length - 1] ?? this.requireManifest().levels[0];
        if (summary === undefined) {
            throw new Error('Level manifest is empty.');
        }
        return summary;
    }

    private requireSummary(levelId: string): LevelSummary {
        const summary = this.requireManifest().levels.find((item) => item.levelId === levelId);
        if (summary === undefined) {
            throw new Error(`Unknown level "${levelId}".`);
        }
        return summary;
    }

    private getNextSummary(summary: LevelSummary): LevelSummary | null {
        return this.requireManifest().levels.find((item) => item.order > summary.order) ?? null;
    }

    private unlockedSummaries(): LevelSummary[] {
        return this.requireManifest().levels
            .filter((summary) => this.storage.isOrderUnlocked(summary.order))
            .map((summary) => ({ ...summary }));
    }

    private requireManifest(): LevelManifest {
        if (this.manifest === null) {
            throw new Error('LevelManager must be initialized before use.');
        }
        return this.manifest;
    }

    private requireCurrentSummary(): LevelSummary {
        if (this.currentSummary === null) {
            throw new Error('No level is currently loaded.');
        }
        return this.currentSummary;
    }
}
