import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { NormalArrow } from '../assets/scripts/core/arrows/NormalArrow.ts';
import { FixedArrow } from '../assets/scripts/core/arrows/FixedArrow.ts';
import { ReverseArrow } from '../assets/scripts/core/arrows/ReverseArrow.ts';
import type { ArrowBase } from '../assets/scripts/core/ArrowBase.ts';
import { Block } from '../assets/scripts/core/Block.ts';
import { CollisionDetector } from '../assets/scripts/core/CollisionDetector.ts';
import { GridPoint } from '../assets/scripts/core/GridPoint.ts';
import { LevelConfigParser } from '../assets/scripts/levels/LevelConfig.ts';
import { StorageManager, type KeyValueStorage } from '../assets/scripts/storage/StorageManager.ts';

const testRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

class MemoryStorage implements KeyValueStorage {
    private readonly values = new Map<string, string>();

    public getItem(key: string): string | null {
        return this.values.get(key) ?? null;
    }

    public setItem(key: string, value: string): void {
        this.values.set(key, value);
    }

    public removeItem(key: string): void {
        this.values.delete(key);
    }
}

const normal = new NormalArrow({
    id: 'normal',
    displayDirection: 'right',
    body: [new GridPoint(0, 0)],
});
const reverse = new ReverseArrow({
    id: 'reverse',
    displayDirection: 'up',
    body: [new GridPoint(0, 2)],
});
const fixed = new FixedArrow({
    id: 'fixed',
    displayDirection: 'left',
    body: [new GridPoint(2, 2)],
});

assert.equal(normal.getMoveDirection(), 'right');
assert.equal(reverse.getMoveDirection(), 'down');
assert.equal(fixed.getMoveDirection(), null);
assert.equal(fixed.move(), false);

const blocker = new NormalArrow({
    id: 'blocker',
    displayDirection: 'down',
    body: [new GridPoint(2, 0), new GridPoint(2, 1)],
});
const blocked = CollisionDetector.inspect(
    normal,
    [normal, blocker],
    [],
    { rows: 4, columns: 4 },
);
assert.equal(blocked.canMove, false);
assert.equal(blocked.blocker?.id, 'blocker');
assert.equal(
    CollisionDetector.canMove(blocker, [normal, blocker], [], { rows: 4, columns: 4 }),
    true,
);

const wallBlocked = CollisionDetector.inspect(
    new NormalArrow({
        id: 'wall-test',
        displayDirection: 'right',
        body: [new GridPoint(0, 1)],
    }),
    [],
    [
        new Block({
            id: 'wall',
            cells: [new GridPoint(2, 1)],
        }),
    ],
    { rows: 3, columns: 4 },
);
assert.equal(wallBlocked.canMove, false);
assert.equal(wallBlocked.blocker?.kind, 'wall');

const manifestRaw = JSON.parse(
    readFileSync(
        path.join(testRoot, 'assets/resources/levels/level-manifest.json'),
        'utf8',
    ),
) as unknown;
const manifest = LevelConfigParser.parseManifest(manifestRaw);
assert.equal(manifest.levels.length, 3);
for (const summary of manifest.levels) {
    const raw = JSON.parse(
        readFileSync(path.join(testRoot, `assets/resources/${summary.resource}.json`), 'utf8'),
    ) as unknown;
    const config = LevelConfigParser.parseLevel(raw);
    assert.equal(config.id, summary.levelId);
    assert.equal(config.order, summary.order);
    assert.ok(config.arrows.some((arrow) => arrow.kind !== 'fixed'));

    const arrows: ArrowBase[] = config.arrows.map((arrow) => {
        const data = {
            id: arrow.id,
            displayDirection: arrow.direction,
            body: arrow.body.map((cell) => GridPoint.from(cell)),
            drawOrder: arrow.drawOrder,
        };
        if (arrow.kind === 'normal') {
            return new NormalArrow(data);
        }
        if (arrow.kind === 'reverse') {
            return new ReverseArrow(data);
        }
        return new FixedArrow(data);
    });
    const blocks = config.walls.map(
        (wall) =>
            new Block({
                id: wall.id,
                cells: wall.cells,
            }),
    );

    let remaining = [...arrows];
    while (remaining.length > 0) {
        const next = CollisionDetector.findMovableArrow(remaining, blocks, config);
        if (next === null) {
            break;
        }
        remaining = remaining.filter((arrow) => arrow.id !== next.id);
    }
    assert.equal(
        remaining.filter((arrow) => arrow.getMoveDirection() !== null).length,
        0,
        `Level ${config.id} must be solvable.`,
    );
}

const memory = new MemoryStorage();
const storage = new StorageManager(memory);
storage.recordLevelCompletion('level-001', 2, 100);
storage.recordLevelCompletion('level-001', 1, 200);
storage.setMaxUnlockedOrder(2);
assert.equal(storage.getLevelProgress('level-001')?.stars, 2);

const reloaded = new StorageManager(memory);
assert.equal(reloaded.getMaxUnlockedOrder(), 2);
assert.equal(reloaded.getLevelProgress('level-001')?.stars, 2);

console.log('Domain tests passed.');
