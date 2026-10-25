import { Direction, type DirectionName } from '../core/Direction';
import type { ArrowKind } from '../core/GameTypes';
import type { GridPointData } from '../core/GridPoint';

export interface StarRules {
    twoStarMaxMistakes: number;
    threeStarMaxMistakes: number;
    twoStarMaxHints: number;
    threeStarMaxHints: number;
}

export interface ArrowConfig {
    id: string;
    kind: ArrowKind;
    direction: DirectionName;
    body: GridPointData[];
    drawOrder: number;
}

export interface WallConfig {
    id: string;
    cells: GridPointData[];
}

export interface LevelConfig {
    id: string;
    order: number;
    name: string;
    rows: number;
    columns: number;
    cellSize: number;
    initialLives: number;
    blockedTapCostsLife: boolean;
    starRules: StarRules;
    arrows: ArrowConfig[];
    walls: WallConfig[];
}

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

const DEFAULT_STAR_RULES: StarRules = {
    twoStarMaxMistakes: 1,
    threeStarMaxMistakes: 0,
    twoStarMaxHints: 1,
    threeStarMaxHints: 0,
};

export class LevelConfigParser {
    public static parseManifest(value: unknown): LevelManifest {
        const record = LevelConfigParser.asRecord(value, 'level manifest');
        const levelsValue = record.levels;
        if (!Array.isArray(levelsValue) || levelsValue.length === 0) {
            throw new Error('Level manifest must contain a non-empty levels array.');
        }

        const levelIds = new Set<string>();
        const orders = new Set<number>();
        const levels = levelsValue.map((entry, index) => {
            const item = LevelConfigParser.asRecord(entry, `levels[${index}]`);
            const summary: LevelSummary = {
                levelId: LevelConfigParser.requiredString(item.levelId, `levels[${index}].levelId`),
                order: LevelConfigParser.requiredPositiveInteger(item.order, `levels[${index}].order`),
                name: LevelConfigParser.requiredString(item.name, `levels[${index}].name`),
                resource: LevelConfigParser.requiredString(item.resource, `levels[${index}].resource`),
            };

            if (levelIds.has(summary.levelId)) {
                throw new Error(`Duplicate level id "${summary.levelId}" in manifest.`);
            }
            if (orders.has(summary.order)) {
                throw new Error(`Duplicate level order "${summary.order}" in manifest.`);
            }
            levelIds.add(summary.levelId);
            orders.add(summary.order);
            return summary;
        });

        return {
            version: LevelConfigParser.optionalPositiveInteger(record.version, 1),
            levels: levels.sort((left, right) => left.order - right.order),
        };
    }

    public static parseLevel(value: unknown): LevelConfig {
        const record = LevelConfigParser.asRecord(value, 'level config');
        const rows = LevelConfigParser.requiredPositiveInteger(record.rows, 'rows');
        const columns = LevelConfigParser.requiredPositiveInteger(record.columns, 'columns');
        const arrowsValue = record.arrows;
        const wallsValue = record.walls ?? [];
        if (!Array.isArray(arrowsValue)) {
            throw new Error('Level config must contain an arrows array.');
        }
        if (!Array.isArray(wallsValue)) {
            throw new Error('Level config walls must be an array.');
        }

        const arrows: ArrowConfig[] = arrowsValue.map((entry, index) =>
            LevelConfigParser.parseArrow(entry, index, rows, columns),
        );
        const walls: WallConfig[] = wallsValue.map((entry, index) =>
            LevelConfigParser.parseWall(entry, index, rows, columns),
        );

        LevelConfigParser.ensureUniqueIds(arrows, walls);
        LevelConfigParser.ensureNoOverlaps(arrows, walls);

        const parsed: LevelConfig = {
            id: LevelConfigParser.requiredString(record.id, 'id'),
            order: LevelConfigParser.requiredPositiveInteger(record.order, 'order'),
            name: LevelConfigParser.requiredString(record.name, 'name'),
            rows,
            columns,
            cellSize: Math.max(32, LevelConfigParser.optionalPositiveInteger(record.cellSize, 96)),
            initialLives: Math.max(
                1,
                LevelConfigParser.optionalPositiveInteger(record.initialLives, 3),
            ),
            blockedTapCostsLife:
                typeof record.blockedTapCostsLife === 'boolean'
                    ? record.blockedTapCostsLife
                    : true,
            starRules: LevelConfigParser.parseStarRules(record.starRules),
            arrows,
            walls,
        };

        if (!arrows.some((arrow) => arrow.kind !== 'fixed')) {
            throw new Error('Level must contain at least one removable arrow.');
        }

        return parsed;
    }

    private static parseArrow(
        value: unknown,
        index: number,
        rows: number,
        columns: number,
    ): ArrowConfig {
        const item = LevelConfigParser.asRecord(value, `arrows[${index}]`);
        const kind = item.kind;
        if (kind !== 'normal' && kind !== 'fixed' && kind !== 'reverse') {
            throw new Error(`arrows[${index}].kind must be normal, fixed, or reverse.`);
        }
        if (!Direction.isName(item.direction)) {
            throw new Error(`arrows[${index}].direction is invalid.`);
        }
        const body = LevelConfigParser.parseCells(
            item.body,
            `arrows[${index}].body`,
            rows,
            columns,
        );
        for (let cellIndex = 1; cellIndex < body.length; cellIndex += 1) {
            const previous = body[cellIndex - 1]!;
            const current = body[cellIndex]!;
            if (Math.abs(previous.x - current.x) + Math.abs(previous.y - current.y) !== 1) {
                throw new Error(
                    `arrows[${index}].body must be an orthogonally connected chain with the head first.`,
                );
            }
        }

        return {
            id: LevelConfigParser.requiredString(item.id, `arrows[${index}].id`),
            kind,
            direction: item.direction,
            body,
            drawOrder: LevelConfigParser.optionalNonNegativeInteger(
                item.drawOrder,
                index,
                `arrows[${index}].drawOrder`,
            ),
        };
    }

    private static parseWall(
        value: unknown,
        index: number,
        rows: number,
        columns: number,
    ): WallConfig {
        const item = LevelConfigParser.asRecord(value, `walls[${index}]`);
        return {
            id: LevelConfigParser.requiredString(item.id, `walls[${index}].id`),
            cells: LevelConfigParser.parseCells(item.cells, `walls[${index}].cells`, rows, columns),
        };
    }

    private static parseCells(
        value: unknown,
        path: string,
        rows: number,
        columns: number,
    ): GridPointData[] {
        if (!Array.isArray(value) || value.length === 0) {
            throw new Error(`${path} must be a non-empty array.`);
        }

        const seen = new Set<string>();
        return value.map((entry, index) => {
            const point = LevelConfigParser.asRecord(entry, `${path}[${index}]`);
            const x = LevelConfigParser.requiredNonNegativeInteger(
                point.x,
                `${path}[${index}].x`,
            );
            const y = LevelConfigParser.requiredNonNegativeInteger(
                point.y,
                `${path}[${index}].y`,
            );
            if (x >= columns || y >= rows) {
                throw new Error(`${path}[${index}] is outside the ${columns}x${rows} board.`);
            }
            const key = `${x},${y}`;
            if (seen.has(key)) {
                throw new Error(`${path} contains duplicate cell ${key}.`);
            }
            seen.add(key);
            return { x, y };
        });
    }

    private static parseStarRules(value: unknown): StarRules {
        if (value === undefined) {
            return { ...DEFAULT_STAR_RULES };
        }

        const record = LevelConfigParser.asRecord(value, 'starRules');
        return {
            twoStarMaxMistakes: LevelConfigParser.optionalNonNegativeInteger(
                record.twoStarMaxMistakes,
                DEFAULT_STAR_RULES.twoStarMaxMistakes,
                'starRules.twoStarMaxMistakes',
            ),
            threeStarMaxMistakes: LevelConfigParser.optionalNonNegativeInteger(
                record.threeStarMaxMistakes,
                DEFAULT_STAR_RULES.threeStarMaxMistakes,
                'starRules.threeStarMaxMistakes',
            ),
            twoStarMaxHints: LevelConfigParser.optionalNonNegativeInteger(
                record.twoStarMaxHints,
                DEFAULT_STAR_RULES.twoStarMaxHints,
                'starRules.twoStarMaxHints',
            ),
            threeStarMaxHints: LevelConfigParser.optionalNonNegativeInteger(
                record.threeStarMaxHints,
                DEFAULT_STAR_RULES.threeStarMaxHints,
                'starRules.threeStarMaxHints',
            ),
        };
    }

    private static ensureUniqueIds(arrows: readonly ArrowConfig[], walls: readonly WallConfig[]): void {
        const ids = new Set<string>();
        for (const object of [...arrows, ...walls]) {
            if (ids.has(object.id)) {
                throw new Error(`Duplicate level object id "${object.id}".`);
            }
            ids.add(object.id);
        }
    }

    private static ensureNoOverlaps(
        arrows: readonly ArrowConfig[],
        walls: readonly WallConfig[],
    ): void {
        const occupied = new Map<string, string>();
        for (const arrow of arrows) {
            for (const cell of arrow.body) {
                const key = `${cell.x},${cell.y}`;
                const owner = occupied.get(key);
                if (owner !== undefined) {
                    throw new Error(`Objects "${owner}" and "${arrow.id}" overlap at ${key}.`);
                }
                occupied.set(key, arrow.id);
            }
        }
        for (const wall of walls) {
            for (const cell of wall.cells) {
                const key = `${cell.x},${cell.y}`;
                const owner = occupied.get(key);
                if (owner !== undefined) {
                    throw new Error(`Objects "${owner}" and "${wall.id}" overlap at ${key}.`);
                }
                occupied.set(key, wall.id);
            }
        }
    }

    private static asRecord(value: unknown, path: string): Record<string, unknown> {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            throw new Error(`${path} must be an object.`);
        }
        return value as Record<string, unknown>;
    }

    private static requiredString(value: unknown, path: string): string {
        if (typeof value !== 'string' || value.trim() === '') {
            throw new Error(`${path} must be a non-empty string.`);
        }
        return value.trim();
    }

    private static requiredPositiveInteger(value: unknown, path: string): number {
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
            throw new Error(`${path} must be a positive integer.`);
        }
        return value;
    }

    private static requiredNonNegativeInteger(value: unknown, path: string): number {
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
            throw new Error(`${path} must be a non-negative integer.`);
        }
        return value;
    }

    private static optionalPositiveInteger(value: unknown, fallback: number): number {
        if (value === undefined) {
            return fallback;
        }
        return LevelConfigParser.requiredPositiveInteger(value, 'integer value');
    }

    private static optionalNonNegativeInteger(
        value: unknown,
        fallback: number,
        path = 'integer value',
    ): number {
        if (value === undefined) {
            return fallback;
        }
        return LevelConfigParser.requiredNonNegativeInteger(value, path);
    }
}
