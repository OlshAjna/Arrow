import { sys } from 'cc';
import type { KeyValueStorage } from './StorageManager';

interface WxStorageApi {
    getStorageSync(key: string): string;
    setStorageSync(key: string, value: string): void;
    removeStorageSync(key: string): void;
}

export class CocosLocalStorage implements KeyValueStorage {
    public getItem(key: string): string | null {
        const wxStorage = this.getWxStorage();
        if (wxStorage !== null) {
            const value = wxStorage.getStorageSync(key);
            return value === '' ? null : value;
        }

        return sys.localStorage.getItem(key);
    }

    public setItem(key: string, value: string): void {
        const wxStorage = this.getWxStorage();
        if (wxStorage !== null) {
            wxStorage.setStorageSync(key, value);
            return;
        }

        sys.localStorage.setItem(key, value);
    }

    public removeItem(key: string): void {
        const wxStorage = this.getWxStorage();
        if (wxStorage !== null) {
            wxStorage.removeStorageSync(key);
            return;
        }

        sys.localStorage.removeItem(key);
    }

    private getWxStorage(): WxStorageApi | null {
        const globalObject = globalThis as unknown as { wx?: WxStorageApi };
        return globalObject.wx ?? null;
    }
}
