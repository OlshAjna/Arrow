import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateLevel } from '../assets/scripts/core/level-validation.ts';
import type { LevelConfig } from '../assets/scripts/core/types.ts';

interface ManifestEntry {
    levelId: string;
    order: number;
    name: string;
    resource: string;
}

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifestPath = path.join(root, 'assets/resources/levels/level-manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    levels: ManifestEntry[];
};

if (!Array.isArray(manifest.levels) || manifest.levels.length === 0) {
    throw new Error('Level manifest is empty.');
}

for (const summary of manifest.levels) {
    const resourcePath = path.join(root, `assets/resources/${summary.resource}.json`);
    const config = JSON.parse(readFileSync(resourcePath, 'utf8')) as LevelConfig;
    validateLevel(config);
    if (config.id !== summary.levelId) {
        throw new Error(`${summary.resource} id does not match manifest ${summary.levelId}`);
    }
    console.log(
        `${summary.order}. ${config.id}  ${config.width}x${config.height}  ` +
            `${config.arrows.length} arrows  ${config.walls.length} walls`,
    );
}

console.log(`Validated ${manifest.levels.length} levels.`);
