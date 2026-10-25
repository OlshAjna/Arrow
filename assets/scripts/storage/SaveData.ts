export const SAVE_SCHEMA_VERSION = 1;
export type LevelProgressStatus = 'unlocked' | 'completed';

export interface LevelProgress {
    levelId: string;
    status: LevelProgressStatus;
    stars: number;
    completedAt: number;
}

export interface ProgressData {
    maxUnlockedOrder: number;
    levels: Record<string, LevelProgress>;
}

export interface SettingsData {
    musicEnabled: boolean;
    soundEnabled: boolean;
    vibrationEnabled: boolean;
}

export interface PlayerSaveData {
    schemaVersion: number;
    updatedAt: number;
    progress: ProgressData;
    settings: SettingsData;
}

export function createDefaultSaveData(now = Date.now()): PlayerSaveData {
    return {
        schemaVersion: SAVE_SCHEMA_VERSION,
        updatedAt: now,
        progress: {
            maxUnlockedOrder: 1,
            levels: {},
        },
        settings: {
            musicEnabled: true,
            soundEnabled: true,
            vibrationEnabled: false,
        },
    };
}
