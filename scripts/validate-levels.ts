import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { LevelConfigParser } from '../assets/scripts/levels/LevelConfig.ts';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifestPath = path.join(root, 'assets/resources/levels/level-manifest.json');
const manifest = LevelConfigParser.parseManifest(
    JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown,
);

for (const summary of manifest.levels) {
    const resourcePath = path.join(root, `assets/resources/${summary.resource}.json`);
    const config = LevelConfigParser.parseLevel(
        JSON.parse(readFileSync(resourcePath, 'utf8')) as unknown,
    );
    console.log(
        `${config.order}. ${config.id}  ${config.columns}x${config.rows}  ` +
            `${config.arrows.length} arrows  ${config.walls.length} walls`,
    );
}

console.log(`Validated ${manifest.levels.length} levels.`);
