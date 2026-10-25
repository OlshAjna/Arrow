import {
  _decorator,
  Color,
  Component,
  EventTouch,
  Graphics,
  Label,
  Layers,
  Node,
  profiler,
  ResolutionPolicy,
  UITransform,
  Vec3,
  view,
} from 'cc';
import {
  DIR_VECTORS,
  GameCore,
  hitTestArrow,
  polylineLength,
  slicePolyline,
  worldArrowGeometry,
  type ArrowBase,
  type Direction,
  type Vec2,
} from './core';
import { GameManager } from './app/GameManager';

const { ccclass } = _decorator;

const DESIGN_W = 800;
const DESIGN_H = 1200;
const BOARD_LEFT = -360;
const BOARD_TOP = 500;
const BOARD_BOTTOM = -460;
const BOARD_HEIGHT = BOARD_TOP - BOARD_BOTTOM;
const INK = new Color(20, 20, 20, 255);
const MUTED = new Color(120, 120, 120, 255);
const RED = new Color(214, 64, 64, 255);
const BORDER = new Color(226, 226, 226, 255);
const PAPER = new Color(255, 255, 255, 255);

interface NudgeState {
  kind: 'exit' | 'nudge';
  arrowId: string;
  direction: Direction;
  distance: number;
  elapsed: number;
  duration: number;
}

@ccclass('GameView')
export class GameView extends Component {
  private manager!: GameManager;
  private game!: GameCore;
  private board!: Node;
  private g!: Graphics;
  private uiRoot!: Node;
  private lifeLabel!: Label;
  private countLabel!: Label;
  private hintLabel!: Label;
  private resetLabel!: Label;
  private messageLabel!: Label;
  private overlayTitle!: Label;
  private overlayDesc!: Label;
  private overlayButton!: Label;
  private overlayLayer!: Node;

  private anim: NudgeState | null = null;
  private hintId: string | null = null;
  private hintRemaining = 0;
  private overlayVisible = false;
  private loading = false;

  onLoad(): void {
    view.setDesignResolutionSize(DESIGN_W, DESIGN_H, ResolutionPolicy.FIXED_WIDTH);
    profiler.hideStats();

    const canvasUi = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    canvasUi.setContentSize(DESIGN_W, DESIGN_H);

    this.board = new Node('Board');
    this.board.layer = Layers.Enum.UI_2D;
    this.board.addComponent(UITransform).setContentSize(DESIGN_W, DESIGN_H);
    this.node.addChild(this.board);
    this.board.setPosition(0, 0, 0);
    this.g = this.board.addComponent(Graphics);

    this.uiRoot = new Node('UI');
    this.uiRoot.layer = Layers.Enum.UI_2D;
    this.uiRoot.addComponent(UITransform).setContentSize(DESIGN_W, DESIGN_H);
    this.node.addChild(this.uiRoot);

    this.createLabels();
    this.node.on(Node.EventType.TOUCH_END, this.onTouch, this);
    (globalThis as unknown as Record<string, unknown>).__gameView = this;
    void this.startGame();
  }

  private async startGame(levelId?: string): Promise<void> {
    this.loading = true;
    this.messageLabel.string = '正在加载关卡...';
    try {
      this.manager = await GameManager.create();
      this.game = levelId
        ? await this.manager.loadLevel(levelId)
        : await this.manager.loadLevel();
      this.anim = null;
      this.hintId = null;
      this.hintRemaining = 0;
      this.overlayVisible = false;
      (globalThis as unknown as Record<string, unknown>).__game = this.game;
      this.updateLabels();
      this.render();
    } catch (error) {
      this.messageLabel.string = error instanceof Error ? error.message : '关卡加载失败';
      this.render();
    } finally {
      this.loading = false;
    }
  }

  debugScreenPoint(x: number, y: number): { x: number; y: number } {
    const ui = this.node.getComponent(UITransform)!;
    const world = ui.convertToWorldSpaceAR(new Vec3(x - 360, BOARD_TOP - y, 0));
    return { x: world.x, y: window.innerHeight - world.y };
  }

  update(dt: number): void {
    if (this.anim) {
      this.anim.elapsed += dt;
      if (this.anim.elapsed >= this.anim.duration) {
        this.finishAnim();
      }
    }
    if (this.hintRemaining > 0) {
      this.hintRemaining -= dt;
      if (this.hintRemaining <= 0) this.hintId = null;
    }
    this.render();
  }

  private createLabels(): void {
    this.lifeLabel = this.makeLabel('生命', '', -342, 544, 17, RED);
    this.countLabel = this.makeLabel('剩余', '', -20, 544, 16, INK);
    this.hintLabel = this.makeLabel('提示', '', 216, 544, 15, INK);
    this.resetLabel = this.makeLabel('重置', '', 342, 544, 15, INK);
    this.messageLabel = this.makeLabel('消息', '', 0, -508, 12, MUTED);

    this.overlayLayer = new Node('Overlay');
    this.overlayLayer.layer = Layers.Enum.UI_2D;
    this.overlayLayer.addComponent(UITransform).setContentSize(DESIGN_W, DESIGN_H);
    this.uiRoot.addChild(this.overlayLayer);
    this.overlayTitle = this.makeLabel('完成', '清屏成功', 0, 40, 34, INK, this.overlayLayer);
    this.overlayDesc = this.makeLabel('说明', '', 0, -10, 14, MUTED, this.overlayLayer);
    this.overlayButton = this.makeLabel('再来', '重新挑战', 0, -76, 16, PAPER, this.overlayLayer);
    this.overlayLayer.active = false;
  }

  private makeLabel(
    name: string,
    text: string,
    x: number,
    y: number,
    size: number,
    color: Color,
    parent: Node = this.uiRoot,
  ): Label {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    parent.addChild(node);
    node.setPosition(x, y, 0);
    const transform = node.addComponent(UITransform);
    transform.setContentSize(260, size + 10);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = size;
    label.lineHeight = size + 6;
    label.color = color;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = Label.Overflow.NONE;
    return label;
  }

  private updateLabels(): void {
    if (!this.game) return;
    this.lifeLabel.string = `${'♥'.repeat(this.game.lives)}${'♡'.repeat(Math.max(0, this.game.maxLife - this.game.lives))}`;
    this.countLabel.string = `第 ${this.manager.currentLevel.order} 关 · 剩余 ${this.game.remainingMovable} / ${this.game.totalMovable}`;
    this.hintLabel.string = `提示 ${this.game.hints}`;
    this.resetLabel.string = '重置';
    this.messageLabel.string = this.game.message;

    const done = this.game.status !== 'playing';
    this.overlayVisible = done;
    this.overlayLayer.active = done;
    if (done) {
      this.overlayTitle.string = this.game.status === 'won' ? '清屏成功' : '挑战失败';
      this.overlayDesc.string = this.game.message;
      this.overlayButton.string = this.game.status === 'won' && this.manager.nextLevelId
        ? '下一关'
        : this.game.status === 'won' ? '再来一次' : '重新挑战';
      this.overlayButton.color = INK;
    }
  }

  private onTouch(event: EventTouch): void {
    if (this.loading || !this.game) return;
    if (this.overlayVisible) {
      if (this.game.status === 'won' && this.manager.nextLevelId) {
        void this.startGame(this.manager.nextLevelId);
      } else {
        this.resetGame();
      }
      return;
    }
    if (this.anim) return;

    const ui = this.node.getComponent(UITransform);
    if (!ui) return;
    const location = event.getUILocation();
    const local = ui.convertToNodeSpaceAR(new Vec3(location.x, location.y, 0));

    if (this.inRect(local.x, local.y, 160, 520, 112, 50)) {
      this.useHint();
      return;
    }
    if (this.inRect(local.x, local.y, 286, 520, 112, 50)) {
      this.resetGame();
      return;
    }

    const bx = local.x - BOARD_LEFT;
    const by = BOARD_TOP - local.y;
    if (bx < 0 || bx > 720 || by < 0 || by > BOARD_HEIGHT) return;

    const arrows = [...this.game.getArrows()]
      .filter((a) => a.alive)
      .sort((a, b) => b.layer - a.layer || a.id.localeCompare(b.id));
    const point: Vec2 = { x: bx, y: by };
    const target = arrows.find((a) => hitTestArrow(point, a));
    if (!target) return;

    this.game.message = '';
    const result = this.manager.checkMove(target.id);
    if (result.kind === 'clear') {
      this.startExit(target, result.distance);
    } else if (result.kind === 'blocked' || result.kind === 'fixed') {
      this.startNudge(target);
    }
    this.updateLabels();
  }

  private useHint(): void {
    if (!this.game) return;
    const id = this.manager.useHint();
    if (id) {
      this.hintId = id;
      this.hintRemaining = 2.2;
    }
    this.updateLabels();
  }

  private resetGame(): void {
    if (!this.game) return;
    this.manager.reset();
    this.anim = null;
    this.hintId = null;
    this.hintRemaining = 0;
    this.overlayVisible = false;
    this.updateLabels();
    this.render();
  }

  private startExit(arrow: ArrowBase, distance: number): void {
    this.anim = {
      kind: 'exit',
      arrowId: arrow.id,
      direction: arrow.moveDirection,
      distance,
      elapsed: 0,
      duration: arrow.points ? 1.2 : 0.52,
    };
  }

  private startNudge(arrow: ArrowBase): void {
    this.anim = {
      kind: 'nudge',
      arrowId: arrow.id,
      direction: arrow.moveDirection,
      distance: 14,
      elapsed: 0,
      duration: 0.42,
    };
  }

  private finishAnim(): void {
    const state = this.anim;
    if (!state) return;
    this.anim = null;
    if (state.kind === 'exit') {
      this.manager.commitClear(state.arrowId);
    } else {
      const result = this.manager.checkMove(state.arrowId);
      this.manager.registerBlocked(state.arrowId, {
        type: result.kind === 'fixed' ? 'fixed' : 'blocked',
        blockerId: result.hit?.targetId,
      });
    }
    this.updateLabels();
  }

  private render(): void {
    const g = this.g;
    g.clear();
    g.fillColor = PAPER;
    g.rect(-DESIGN_W / 2, -DESIGN_H / 2, DESIGN_W, DESIGN_H);
    g.fill();

    // 棋盘边框和浅色分隔线
    g.strokeColor = BORDER;
    g.lineWidth = 1;
    g.rect(BOARD_LEFT, BOARD_BOTTOM, DESIGN_W - 80, BOARD_HEIGHT);
    g.stroke();
    g.moveTo(BOARD_LEFT, BOARD_TOP + 15);
    g.lineTo(-BOARD_LEFT, BOARD_TOP + 15);
    g.stroke();

    this.drawButtons(g);
    if (!this.game) return;
    this.drawArrows(g);
    this.drawHint(g);
    this.drawOverlay(g);
  }

  private drawOverlay(g: Graphics): void {
    if (!this.overlayVisible) return;
    g.fillColor = new Color(255, 255, 255, 242);
    g.rect(BOARD_LEFT, BOARD_BOTTOM, DESIGN_W - 80, BOARD_HEIGHT);
    g.fill();
    g.strokeColor = INK;
    g.lineWidth = 1.5;
    g.roundRect(-110, -100, 220, 56, 12);
    g.stroke();
  }

  private drawButtons(g: Graphics): void {
    g.lineWidth = 1.5;
    g.strokeColor = INK;
    g.roundRect(160, 520, 112, 50, 10);
    g.stroke();
    g.roundRect(286, 520, 112, 50, 10);
    g.stroke();
  }

  private drawArrows(g: Graphics): void {
    const arrows = [...this.game.getArrows()]
      .filter((a) => a.alive)
      .sort((a, b) => a.layer - b.layer || a.id.localeCompare(b.id));

    for (const arrow of arrows) {
      if (this.anim?.arrowId === arrow.id && this.anim.kind === 'exit' && arrow.points) {
        this.drawRope(g, arrow, this.anim);
      } else {
        const offset = this.anim?.arrowId !== arrow.id
          ? 0
          : this.anim.kind === 'nudge'
            ? this.animOffset()
            : this.exitOffset();
        this.drawStaticArrow(g, arrow, offset);
      }
    }
  }

  private animOffset(): number {
    if (!this.anim) return 0;
    const t = this.anim.elapsed / this.anim.duration;
    const forward = t < 0.5;
    const k = forward ? t / 0.5 : (1 - t) / 0.5;
    return this.anim.distance * Math.max(0, Math.min(1, k));
  }

  private exitOffset(): number {
    if (!this.anim) return 0;
    const t = Math.max(0, Math.min(1, this.anim.elapsed / this.anim.duration));
    return this.anim.distance * easeInOutCubic(t);
  }

  private drawStaticArrow(g: Graphics, arrow: ArrowBase, offset: number): void {
    const dir = DIR_VECTORS[arrow.moveDirection];
    const shift = (p: Vec2): Vec2 => ({
      x: p.x + dir.x * offset,
      y: p.y + dir.y * offset,
    });

    if (arrow.points && arrow.points.length >= 2) {
      const shifted = arrow.points.map(shift);
      this.strokePath(g, shifted);
      this.drawHead(g, shifted[shifted.length - 1], arrow.dir);
      return;
    }

    const geometry = worldArrowGeometry(arrow);
    this.strokePath(g, geometry.shaft.map(shift));
    this.fillPath(g, geometry.head.map(shift));
  }

  private drawRope(g: Graphics, arrow: ArrowBase, state: NudgeState): void {
    const points = arrow.points!;
    const t = Math.max(0, Math.min(1, state.elapsed / state.duration));
    const progress = easeInOutCubic(t);
    const total = polylineLength(points);
    const dir = DIR_VECTORS[state.direction];
    const head0 = points[points.length - 1];
    const tailTravel = (total + state.distance) * progress;
    const headTravel = tailTravel + total;
    const far = {
      x: head0.x + dir.x * (state.distance + total + 20),
      y: head0.y + dir.y * (state.distance + total + 20),
    };
    const virtual = [...points, far];
    const rope = slicePolyline(virtual, tailTravel, headTravel);
    if (rope.length < 2) return;
    this.strokePath(g, rope);
    this.drawHead(g, rope[rope.length - 1], arrow.dir);
  }

  private strokePath(g: Graphics, points: readonly Vec2[]): void {
    if (points.length < 2) return;
    g.lineWidth = 3.5;
    g.strokeColor = INK;
    g.lineCap = Graphics.LineCap.ROUND;
    g.lineJoin = Graphics.LineJoin.ROUND;
    const p0 = this.toLocal(points[0]);
    g.moveTo(p0.x, p0.y);
    for (let i = 1; i < points.length; i += 1) {
      const p = this.toLocal(points[i]);
      g.lineTo(p.x, p.y);
    }
    g.stroke();
  }

  private fillPath(g: Graphics, points: readonly Vec2[]): void {
    if (points.length < 3) return;
    const first = this.toLocal(points[0]);
    g.fillColor = INK;
    g.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i += 1) {
      const point = this.toLocal(points[i]);
      g.lineTo(point.x, point.y);
    }
    g.close();
    g.fill();
  }

  private drawHead(g: Graphics, head: Vec2, direction: Direction): void {
    const d = DIR_VECTORS[direction];
    const tip = this.toLocal(head);
    const dx = d.x;
    const dy = -d.y;
    const px = -dy;
    const py = dx;
    const baseX = tip.x - dx * 15;
    const baseY = tip.y - dy * 15;
    g.fillColor = INK;
    g.moveTo(tip.x, tip.y);
    g.lineTo(baseX + px * 8, baseY + py * 8);
    g.lineTo(baseX - px * 8, baseY - py * 8);
    g.close();
    g.fill();
  }

  private drawHint(g: Graphics): void {
    if (!this.hintId) return;
    const arrow = this.game.getArrow(this.hintId);
    if (!arrow) return;
    const head = arrow.points?.length
      ? arrow.points[arrow.points.length - 1]
      : arrow.headPoint;
    const p = this.toLocal(head);
    g.strokeColor = RED;
    g.lineWidth = 2;
    g.circle(p.x, p.y, 16);
    g.stroke();
  }

  private toLocal(p: Vec2): Vec2 {
    return {
      x: p.x - 360,
      y: BOARD_TOP - p.y,
    };
  }

  private inRect(x: number, y: number, rx: number, ry: number, rw: number, rh: number): boolean {
    return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
  }
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
