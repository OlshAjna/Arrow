import {
    _decorator,
    Color,
    Component,
    Graphics,
    Label,
    Node,
    Tween,
    tween,
    UITransform,
    Vec3,
    view,
} from 'cc';
import type { ArrowBase } from '../core/ArrowBase';
import { Direction, type DirectionName } from '../core/Direction';
import type { GridPoint } from '../core/GridPoint';
import type { ArrowKind, GameStatus } from '../core/GameTypes';
import type { LevelRuntime } from './LevelManager';

const { ccclass, property } = _decorator;

@ccclass('UIManager')
export class UIManager extends Component {
    @property(Node)
    public boardRoot: Node | null = null;

    @property(Node)
    public effectsRoot: Node | null = null;

    @property(Label)
    public livesLabel: Label | null = null;

    @property(Label)
    public levelLabel: Label | null = null;

    public onArrowTap: ((arrowId: string) => void) | null = null;

    private readonly arrowNodes = new Map<string, Node>();
    private runtime: LevelRuntime | null = null;
    private messageNode: Node | null = null;

    public renderLevel(runtime: LevelRuntime): void {
        this.runtime = runtime;
        this.ensureContainers();
        this.boardRoot!.removeAllChildren();
        this.arrowNodes.clear();
        this.clearMessage();

        const { config } = runtime;
        const width = config.columns * config.cellSize;
        const height = config.rows * config.cellSize;
        const boardTransform = this.boardRoot!.getComponent(UITransform) ?? this.boardRoot!.addComponent(UITransform);
        boardTransform.setContentSize(width, height);
        this.boardRoot!.setPosition(0, 0, 0);

        this.drawGrid(width, height, config.cellSize);
        this.drawWalls(runtime);

        for (const arrow of [...runtime.arrows].sort((left, right) => left.drawOrder - right.drawOrder)) {
            this.drawArrow(arrow);
        }

        if (this.levelLabel !== null) {
            this.levelLabel.string = `${config.order}. ${config.name}`;
        }
    }

    public updateHUD(lives: number, status: GameStatus): void {
        if (this.livesLabel !== null) {
            this.livesLabel.string = `生命 ${lives}`;
        }
        if (this.levelLabel !== null && status === 'won') {
            this.levelLabel.string = `${this.levelLabel.string}  已通关`;
        } else if (this.levelLabel !== null && status === 'lost') {
            this.levelLabel.string = `${this.levelLabel.string}  挑战失败`;
        }
    }

    public animateArrowExit(arrow: ArrowBase): Promise<void> {
        const node = this.arrowNodes.get(arrow.id);
        if (node === undefined) {
            return Promise.resolve();
        }

        const direction = arrow.getMoveDirection();
        if (direction === null || this.runtime === null) {
            return Promise.resolve();
        }

        const board = this.runtime.config;
        const distance = (board.rows + board.columns + 4) * board.cellSize;
        const delta = this.directionToLocal(direction, distance);
        const target = node.position.clone().add(delta);

        return new Promise<void>((resolve) => {
            Tween.stopAllByTarget(node);
            tween(node)
                .to(0.32, { position: target }, { easing: 'quadIn' })
                .call(() => resolve())
                .start();
        });
    }

    public animateBlocked(arrow: ArrowBase): Promise<void> {
        const node = this.arrowNodes.get(arrow.id);
        if (node === undefined || this.runtime === null) {
            return Promise.resolve();
        }

        const origin = node.position.clone();
        const nudge = this.directionToLocal(
            arrow.displayDirection,
            this.runtime.config.cellSize * 0.22,
        );
        const target = origin.clone().add(nudge);

        return new Promise<void>((resolve) => {
            Tween.stopAllByTarget(node);
            tween(node)
                .to(0.08, { position: target }, { easing: 'quadOut' })
                .to(0.14, { position: origin }, { easing: 'quadIn' })
                .call(() => resolve())
                .start();
        });
    }

    public showHint(arrowId: string): void {
        const node = this.arrowNodes.get(arrowId);
        if (node === undefined) {
            return;
        }

        Tween.stopAllByTarget(node);
        node.setScale(1, 1, 1);
        tween(node)
            .to(0.12, { scale: new Vec3(1.16, 1.16, 1) })
            .to(0.12, { scale: new Vec3(1, 1, 1) })
            .to(0.12, { scale: new Vec3(1.16, 1.16, 1) })
            .to(0.12, { scale: new Vec3(1, 1, 1) })
            .start();
    }

    public removeArrowNode(arrowId: string): void {
        const node = this.arrowNodes.get(arrowId);
        if (node === undefined) {
            return;
        }
        this.arrowNodes.delete(arrowId);
        node.destroy();
    }

    public showMessage(message: string): void {
        this.ensureContainers();
        this.clearMessage();

        const node = new Node('Message');
        this.effectsRoot!.addChild(node);
        node.setPosition(0, this.currentHalfHeight() + 42, 0);
        const label = node.addComponent(Label);
        label.string = message;
        label.fontSize = 28;
        label.lineHeight = 34;
        label.color = new Color(245, 196, 66, 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        this.messageNode = node;
    }

    public triggerReset(): void {
        this.onResetRequested?.();
    }

    public triggerHint(): void {
        this.onHintRequested?.();
    }

    public triggerNextLevel(): void {
        this.onNextLevelRequested?.();
    }

    public onResetRequested: (() => void) | null = null;
    public onHintRequested: (() => void) | null = null;
    public onNextLevelRequested: (() => void) | null = null;

    private drawGrid(width: number, height: number, cellSize: number): void {
        const node = this.createChild('Grid', this.boardRoot!);
        const graphics = node.addComponent(Graphics);
        graphics.lineWidth = 1.5;
        graphics.strokeColor = new Color(113, 124, 138, 82);

        const left = -width / 2;
        const top = height / 2;
        const columns = Math.round(width / cellSize);
        const rows = Math.round(height / cellSize);

        for (let column = 0; column <= columns; column += 1) {
            const x = left + column * cellSize;
            graphics.moveTo(x, top);
            graphics.lineTo(x, top - height);
        }
        for (let row = 0; row <= rows; row += 1) {
            const y = top - row * cellSize;
            graphics.moveTo(left, y);
            graphics.lineTo(left + width, y);
        }
        graphics.stroke();
    }

    private drawWalls(runtime: LevelRuntime): void {
        const node = this.createChild('Walls', this.boardRoot!);
        const graphics = node.addComponent(Graphics);
        graphics.fillColor = new Color(76, 84, 94, 255);
        graphics.strokeColor = new Color(40, 45, 52, 255);
        graphics.lineWidth = 2;

        const cellSize = runtime.config.cellSize;
        for (const wall of runtime.blocks) {
            for (const cell of wall.cells) {
                const position = this.cellToLocal(cell, runtime);
                graphics.rect(
                    position.x - cellSize * 0.42,
                    position.y - cellSize * 0.42,
                    cellSize * 0.84,
                    cellSize * 0.84,
                );
            }
        }
        graphics.fill();
        graphics.stroke();
    }

    private drawArrow(arrow: ArrowBase): void {
        if (this.runtime === null) {
            return;
        }

        const head = arrow.head;
        const headPosition = this.cellToLocal(head, this.runtime);
        const node = this.createChild(`Arrow-${arrow.id}`, this.boardRoot!);
        node.setPosition(headPosition);
        node.setSiblingIndex(arrow.drawOrder + 1);
        const transform = node.addComponent(UITransform);
        transform.setContentSize(
            this.runtime.config.cellSize * 1.25,
            this.runtime.config.cellSize * 1.25,
        );

        const graphics = node.addComponent(Graphics);
        const color = this.colorFor(arrow.arrowType);
        graphics.lineWidth = Math.max(4, this.runtime.config.cellSize * 0.09);
        graphics.strokeColor = color;
        graphics.fillColor = color;

        const points = arrow.body.map((cell) => {
            const deltaX = (cell.x - head.x) * this.runtime!.config.cellSize;
            const deltaY = (head.y - cell.y) * this.runtime!.config.cellSize;
            return new Vec3(deltaX, deltaY, 0);
        });

        if (points.length > 0) {
            graphics.moveTo(points[0]!.x, points[0]!.y);
            for (const point of points.slice(1)) {
                graphics.lineTo(point.x, point.y);
            }
            graphics.stroke();
        }

        const direction = Direction.delta(arrow.displayDirection);
        const tipLength = this.runtime.config.cellSize * 0.2;
        const wing = this.runtime.config.cellSize * 0.13;
        const tip = new Vec3(direction.x * tipLength, -direction.y * tipLength, 0);
        const perpendicular = new Vec3(-direction.y, -direction.x, 0);
        const back = new Vec3(
            tip.x - direction.x * wing,
            tip.y + direction.y * wing,
            0,
        );

        graphics.moveTo(tip.x, tip.y);
        graphics.lineTo(back.x + perpendicular.x * wing, back.y + perpendicular.y * wing);
        graphics.moveTo(tip.x, tip.y);
        graphics.lineTo(back.x - perpendicular.x * wing, back.y - perpendicular.y * wing);
        graphics.stroke();
        graphics.circle(0, 0, this.runtime.config.cellSize * 0.12);
        graphics.fill();

        node.on(Node.EventType.TOUCH_END, () => this.onArrowTap?.(arrow.id), this);
        this.arrowNodes.set(arrow.id, node);
    }

    private ensureContainers(): void {
        if (this.boardRoot === null) {
            const node = new Node('BoardRoot');
            this.node.addChild(node);
            this.boardRoot = node;
        }
        if (this.boardRoot.getComponent(UITransform) === null) {
            this.boardRoot.addComponent(UITransform);
        }

        if (this.effectsRoot === null) {
            const node = new Node('EffectsRoot');
            this.node.addChild(node);
            this.effectsRoot = node;
        }
        if (this.effectsRoot.getComponent(UITransform) === null) {
            this.effectsRoot.addComponent(UITransform);
        }
    }

    private createChild(name: string, parent: Node): Node {
        const node = new Node(name);
        parent.addChild(node);
        return node;
    }

    private cellToLocal(point: GridPoint, runtime: LevelRuntime): Vec3 {
        const { rows, columns, cellSize } = runtime.config;
        return new Vec3(
            (point.x - (columns - 1) / 2) * cellSize,
            ((rows - 1) / 2 - point.y) * cellSize,
            0,
        );
    }

    private directionToLocal(direction: DirectionName, distance: number): Vec3 {
        const delta = Direction.delta(direction);
        return new Vec3(delta.x * distance, -delta.y * distance, 0);
    }

    private colorFor(kind: ArrowKind): Color {
        switch (kind) {
            case 'normal':
                return new Color(52, 137, 220, 255);
            case 'fixed':
                return new Color(105, 112, 122, 255);
            case 'reverse':
                return new Color(226, 126, 55, 255);
        }
    }

    private currentHalfHeight(): number {
        if (this.runtime === null) {
            return view.getVisibleSize().height * 0.25;
        }
        return this.runtime.config.rows * this.runtime.config.cellSize * 0.5;
    }

    private clearMessage(): void {
        if (this.messageNode !== null) {
            this.messageNode.destroy();
            this.messageNode = null;
        }
    }
}
