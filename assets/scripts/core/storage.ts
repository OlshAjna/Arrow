export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryStorage implements StorageAdapter {
  private readonly data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}

/**
 * 轻量本地存储封装；真正接入微信小游戏时，把 adapter 换成
 * wx.getStorageSync / wx.setStorageSync 即可，不改变上层调用。
 */
export class StorageManager {
  constructor(private readonly adapter: StorageAdapter = new MemoryStorage()) {}

  get<T>(key: string, fallback: T): T {
    try {
      const raw = this.adapter.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  set<T>(key: string, value: T): void {
    try {
      this.adapter.setItem(key, JSON.stringify(value));
    } catch {
      // 存储失败不应阻断对局；真实工程可上报日志。
    }
  }

  remove(key: string): void {
    try {
      this.adapter.removeItem(key);
    } catch {
      // ignore
    }
  }

  clear(keys: string[]): void {
    for (const key of keys) this.remove(key);
  }
}
