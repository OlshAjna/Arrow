import { _decorator, Component, director } from 'cc';
import { CollisionDetector } from '../core/CollisionDetector';
import type { GameStatus } from '../core/GameTypes';
import type { LevelRuntime } from '../managers/LevelManager';
import { LevelManager } from '../managers/LevelManager';
import { CocosLocalStorage } from '../storage/CocosLocalStorage';
import { StorageManager } from '../storage/StorageManager';
import { UIManager } from '../managers/UIManager';

const { ccclass, property } = _decorator;

@ccclass('GameManager')
export class GameManager extends Component {
    public static instance: GameManager | null = null;

    @property(UIManager)
    public uiManager: UIManager | null = null;

    private storageManager: StorageManager | null = null;
    private levelManager: LevelManager | null = null;
    private lives = 0;
    private mistakes = 0;
    private hintsUsed = 0;
    private status: GameStatus = 'idle';
    private busy = false;
    private nextLevelId: string | null = null;

    protected onLoad(): void {
        if (GameManager.instance !== null && GameManager.instance !== this) {
            this.node.destroy();
            return;
        }

        GameManager.instance = this;
        director.addPersistRootNode(this.node);
        this.uiManager = this.uiManager ?? this.getComponent(UIManager) ?? this.node.addComponent(UIManager);
        this.uiManager.onArrowTap = (arrowId) => this.handleArrowTap(arrowId);
        this.uiManager.onResetRequested = () => this.resetCurrentLevel();
        this.uiManager.onHintRequested = () => this.showHint();
        this.uiManager.onNextLevelRequested = () => this.loadNextLevel();
    }

    protected start(): void {
        void this.bootstrap();
    }

    protected onDestroy(): void {
        if (GameManager.instance === this) {
            GameManager.instance = null;
        }
        if (this.uiManager !== null) {
            this.uiManager.onArrowTap = null;
            this.uiManager.onResetRequested = null;
            this.uiManager.onHintRequested = null;
            this.uiManager.onNextLevelRequested = null;
        }
    }

    public async loadLevel(levelId?: string): Promise<void> {
        if (this.levelManager === null || this.uiManager === null) {
            return;
        }

        this.busy = true;
        this.status = 'idle';
        try {
            const runtime = await this.levelManager.loadLevel(levelId);
            this.beginLevel(runtime);
        } catch (error) {
            this.status = 'lost';
            this.uiManager.showMessage(error instanceof Error ? error.message : '关卡加载失败');
        } finally {
            this.busy = false;
        }
    }

    public resetCurrentLevel(): void {
        if (this.levelManager === null || this.uiManager === null || this.busy) {
            return;
        }

        const runtime = this.levelManager.resetCurrentLevel();
        this.beginLevel(runtime);
    }

    public showHint(): void {
        if (this.levelManager === null || this.uiManager === null || this.busy) {
            return;
        }
        if (this.status !== 'playing') {
            return;
        }

        const hintArrowId = this.levelManager.getHintArrowId();
        if (hintArrowId === null) {
            this.uiManager.showMessage('当前没有可释放箭头');
            return;
        }

        this.hintsUsed += 1;
        this.uiManager.showHint(hintArrowId);
    }

    public loadNextLevel(): void {
        if (this.nextLevelId === null || this.busy) {
            return;
        }
        void this.loadLevel(this.nextLevelId);
    }

    private async bootstrap(): Promise<void> {
        this.storageManager = new StorageManager(new CocosLocalStorage());
        this.levelManager = new LevelManager(this.storageManager);

        try {
            await this.levelManager.initialize();
            await this.loadLevel();
        } catch (error) {
            this.status = 'lost';
            this.uiManager?.showMessage(error instanceof Error ? error.message : '初始化失败');
        }
    }

    private beginLevel(runtime: LevelRuntime): void {
        if (this.uiManager === null) {
            return;
        }

        this.lives = runtime.config.initialLives;
        this.mistakes = 0;
        this.hintsUsed = 0;
        this.nextLevelId = null;
        this.status = 'playing';
        this.busy = false;
        this.uiManager.renderLevel(runtime);
        this.uiManager.updateHUD(this.lives, this.status);
    }

    private async handleArrowTap(arrowId: string): Promise<void> {
        if (
            this.levelManager === null ||
            this.uiManager === null ||
            this.busy ||
            this.status !== 'playing'
        ) {
            return;
        }

        const runtime = this.levelManager.current;
        const arrow = runtime.arrows.find((item) => item.id === arrowId);
        if (arrow === undefined || arrow.isRemoved()) {
            return;
        }

        this.busy = true;
        const result = CollisionDetector.inspect(
            arrow,
            runtime.arrows,
            runtime.blocks,
            runtime.config,
        );

        if (!result.canMove) {
            arrow.beginReturn();
            await this.uiManager.animateBlocked(arrow);
            arrow.reset();
            this.mistakes += 1;
            if (runtime.config.blockedTapCostsLife) {
                this.lives = Math.max(0, this.lives - 1);
            }
            this.uiManager.updateHUD(this.lives, this.status);
            this.busy = false;
            if (this.lives === 0) {
                this.finishAsLost();
            }
            return;
        }

        arrow.move();
        await this.uiManager.animateArrowExit(arrow);
        arrow.eliminate();
        runtime.arrows = runtime.arrows.filter((item) => item.id !== arrow.id);
        this.uiManager.removeArrowNode(arrow.id);
        this.busy = false;

        if (this.levelManager.getMovableArrowCount(runtime) === 0) {
            this.finishAsWon(runtime);
        }
    }

    private finishAsWon(runtime: LevelRuntime): void {
        if (this.uiManager === null || this.levelManager === null) {
            return;
        }

        this.status = 'won';
        const stars = this.calculateStars(runtime);
        this.nextLevelId = this.levelManager.completeCurrentLevel(stars);
        this.uiManager.updateHUD(this.lives, this.status);
        this.uiManager.showMessage(`通关  ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`);
    }

    private finishAsLost(): void {
        if (this.uiManager === null) {
            return;
        }
        this.status = 'lost';
        this.uiManager.updateHUD(this.lives, this.status);
        this.uiManager.showMessage('生命耗尽，点击重置再试一次');
    }

    private calculateStars(runtime: LevelRuntime): number {
        const rules = runtime.config.starRules;
        if (
            this.mistakes <= rules.threeStarMaxMistakes &&
            this.hintsUsed <= rules.threeStarMaxHints
        ) {
            return 3;
        }
        if (
            this.mistakes <= rules.twoStarMaxMistakes &&
            this.hintsUsed <= rules.twoStarMaxHints
        ) {
            return 2;
        }
        return 1;
    }
}
