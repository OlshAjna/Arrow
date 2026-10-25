import {
    SAVE_SCHEMA_VERSION,
    createDefaultSaveData,
    type LevelProgress,
    type PlayerSaveData,
} from './SaveData';

export interface KeyValueStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

export class StorageManager {
    public static readonly SAVE_KEY = 'arrow-game-save';

    private readonly storage: KeyValueStorage;
    private cache: PlayerSaveData;

    public constructor(storage: KeyValueStorage) {
        this.storage = storage;
        this.cache = this.readOrCreate();
    }

    public get data(): PlayerSaveData {
        return this.clone(this.cache);
    }

    public getMaxUnlockedOrder(): number {
        return this.cache.progress.maxUnlockedOrder;
    }

    public isOrderUnlocked(order: number): boolean {
        return order <= this.cache.progress.maxUnlockedOrder;
    }

    public getLevelProgress(levelId: string): LevelProgress | null {
        return this.cache.progress.levels[levelId] ?? null;
    }

    public setMaxUnlockedOrder(order: number): void {
        this.cache.progress.maxUnlockedOrder = Math.max(
            this.cache.progress.maxUnlockedOrder,
            Math.max(1, Math.floor(order)),
        );
        this.commit();
    }

    public recordLevelCompletion(levelId: string, stars: number, completedAt = Date.now()): LevelProgress {
        const previous = this.cache.progress.levels[levelId];
        const record: LevelProgress = {
            levelId,
            status: 'completed',
            stars: Math.min(3, Math.max(previous?.stars ?? 0, Math.floor(stars))),
            completedAt,
        };
        this.cache.progress.levels[levelId] = record;
        this.commit();
        return { ...record };
    }

    public updateSettings(settings: Partial<PlayerSaveData['settings']>): void {
        this.cache.settings = {
            ...this.cache.settings,
            ...settings,
        };
        this.commit();
    }

    public resetProgress(): void {
        this.cache = createDefaultSaveData();
        this.commit();
    }

    private readOrCreate(): PlayerSaveData {
        const raw = this.storage.getItem(StorageManager.SAVE_KEY);
        if (raw === null) {
            return createDefaultSaveData();
        }

        try {
            return this.normalize(JSON.parse(raw) as unknown);
        } catch {
            return createDefaultSaveData();
        }
    }

    private commit(): void {
        this.cache.schemaVersion = SAVE_SCHEMA_VERSION;
        this.cache.updatedAt = Date.now();
        this.storage.setItem(StorageManager.SAVE_KEY, JSON.stringify(this.cache));
    }

    private normalize(value: unknown): PlayerSaveData {
        const defaults = createDefaultSaveData();
        if (!this.isRecord(value)) {
            return defaults;
        }

        const progress = this.isRecord(value.progress) ? value.progress : {};
        const settings = this.isRecord(value.settings) ? value.settings : {};
        const levels = this.isRecord(progress.levels) ? progress.levels : {};
        const normalizedLevels: Record<string, LevelProgress> = {};

        for (const [levelId, record] of Object.entries(levels)) {
            if (!this.isRecord(record)) {
                continue;
            }

            const stars = this.toInteger(record.stars, 0);
            normalizedLevels[levelId] = {
                levelId,
                status: record.status === 'completed' ? 'completed' : 'unlocked',
                stars: Math.min(3, Math.max(0, stars)),
                completedAt: Math.max(0, this.toInteger(record.completedAt, 0)),
            };
        }

        return {
            schemaVersion: this.toInteger(value.schemaVersion, SAVE_SCHEMA_VERSION),
            updatedAt: this.toInteger(value.updatedAt, defaults.updatedAt),
            progress: {
                maxUnlockedOrder: Math.max(
                    1,
                    this.toInteger(progress.maxUnlockedOrder, defaults.progress.maxUnlockedOrder),
                ),
                levels: normalizedLevels,
            },
            settings: {
                musicEnabled:
                    typeof settings.musicEnabled === 'boolean'
                        ? settings.musicEnabled
                        : defaults.settings.musicEnabled,
                soundEnabled:
                    typeof settings.soundEnabled === 'boolean'
                        ? settings.soundEnabled
                        : defaults.settings.soundEnabled,
                vibrationEnabled:
                    typeof settings.vibrationEnabled === 'boolean'
                        ? settings.vibrationEnabled
                        : defaults.settings.vibrationEnabled,
            },
        };
    }

    private toInteger(value: unknown, fallback: number): number {
        return typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }

    private clone(data: PlayerSaveData): PlayerSaveData {
        return JSON.parse(JSON.stringify(data)) as PlayerSaveData;
    }
}
