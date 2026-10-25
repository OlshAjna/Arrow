import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GameCore } from '../assets/scripts/core/game-core.ts';
import { rayAABB } from '../assets/scripts/core/collision.ts';
import type { LevelConfig } from '../assets/scripts/core/types.ts';
import { LevelManager } from '../assets/scripts/managers/LevelManager.ts';
import { StorageManager, type KeyValueStorage } from '../assets/scripts/storage/StorageManager.ts';
import type { JsonAssetLoader } from '../assets/scripts/utils/JsonResourceLoader.ts';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

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

class JsonMapLoader implements JsonAssetLoader {
    public constructor(private readonly values: Record<string, unknown>) {}

    public async load<T>(resourcePath: string): Promise<T> {
        if (!(resourcePath in this.values)) {
            throw new Error(`Missing JSON resource: ${resourcePath}`);
        }
        return JSON.parse(JSON.stringify(this.values[resourcePath])) as T;
    }
}

function readJson(relativePath: string): unknown {
    return JSON.parse(readFileSync(path.join(root, relativePath), 'utf8')) as unknown;
}

function clearSolvableArrows(game: GameCore): void {
    let guard = 0;
    while (game.status === 'playing' && guard < 100) {
        guard += 1;
        const next = game
            .getArrows()
            .find((arrow) => arrow.alive && arrow.movable && game.checkMove(arrow.id).kind === 'clear');
        if (!next) {
            break;
        }
        game.commitClear(next.id);
    }
    assert.equal(game.status, 'won');
}

assert.equal(
    rayAABB({ x: 0, y: 10 }, { x: 1, y: 0 }, { x: 100, y: 0, width: 20, height: 20 }),
    100,
);

const shortLevel = readJson('assets/resources/levels/level-001.json') as LevelConfig;
const longLevel = readJson('assets/resources/levels/level-002.json') as LevelConfig;
const manifest = readJson('assets/resources/levels/level-manifest.json');

const shortGame = new GameCore(shortLevel);
assert.equal(shortGame.checkMove('a2').kind, 'clear');
assert.equal(shortGame.checkMove('a1').kind, 'blocked');
assert.equal(shortGame.checkMove('a8').kind, 'fixed');
clearSolvableArrows(shortGame);

const longGame = new GameCore(longLevel);
assert.equal(longGame.getArrows().length, 24);
clearSolvableArrows(longGame);

const storageAdapter = new MemoryStorage();
const storage = new StorageManager(storageAdapter);
const loader = new JsonMapLoader({
    'levels/level-manifest': manifest,
    'levels/level-001': shortLevel,
    'levels/level-002': longLevel,
});
const levels = new LevelManager(storage, loader);
await levels.initialize();
const loadedShort = await levels.loadLevel('iter3-demo-01');
clearSolvableArrows(loadedShort);
assert.equal(levels.completeCurrentLevel(3), 'long-maze-01');
assert.equal(storage.getMaxUnlockedOrder(), 2);
assert.equal(storage.getLevelProgress('iter3-demo-01')?.stars, 3);

const reloaded = new LevelManager(new StorageManager(storageAdapter), loader);
const loadedLong = await reloaded.loadLevel('long-maze-01');
assert.equal(loadedLong.getArrows().length, 24);

console.log('Integrated gameplay tests passed.');
