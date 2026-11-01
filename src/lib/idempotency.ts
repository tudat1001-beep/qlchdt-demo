const STORAGE_KEY = 'qlchdt_idempotency_keys';

/**
 * Generate a cryptographically secure UUID.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  throw new Error('Môi trường trình duyệt không hỗ trợ crypto.randomUUID');
}

/**
 * Compute SHA-256 hex digest of a string to avoid storing raw PII payload in sessionStorage.
 * Fails clearly if crypto.subtle is unavailable to guarantee cryptographic idempotency safety.
 */
export async function computeSha256(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  throw new Error('Web Cryptography API (crypto.subtle) không khả dụng. Thao tác ghi bị chặn để đảm bảo an toàn chống trùng lặp.');
}

/**
 * IdempotencyManager:
 * - Computes SHA-256 signature for each mutating request (method + url + normalized body)
 * - Retains assigned Idempotency-Key UUID across page reloads in sessionStorage
 * - NO TTL: keys are retained until server confirms receipt and parsing succeeds,
 *   preventing duplicate financial / inventory records on uncertain reloads.
 * - Fails clearly if sessionStorage fails, blocking write before fetch to prevent silent claim of reload-safety.
 * - Cleared upon parsed success or explicit user logout.
 */
class IdempotencyManager {
  private inMemoryCache = new Map<string, string>();

  private getStorage(): Record<string, string> {
    const storage = typeof window !== 'undefined' ? window.sessionStorage : (globalThis as unknown as { sessionStorage?: Storage }).sessionStorage;
    if (typeof window !== 'undefined' && !storage) {
      throw new Error('sessionStorage không khả dụng trên trình duyệt. Thao tác ghi bị chặn để ngăn trùng lặp.');
    }
    if (!storage) return {};
    try {
      const item = storage.getItem(STORAGE_KEY);
      return item ? JSON.parse(item) : {};
    } catch (err) {
      throw new Error(`Bộ nhớ phiên (sessionStorage) không thể truy cập: ${err instanceof Error ? err.message : String(err)}. Thao tác ghi bị chặn để ngăn trùng lặp.`);
    }
  }

  private setStorage(record: Record<string, string>): void {
    const storage = typeof window !== 'undefined' ? window.sessionStorage : (globalThis as unknown as { sessionStorage?: Storage }).sessionStorage;
    if (typeof window !== 'undefined' && !storage) {
      throw new Error('sessionStorage không khả dụng trên trình duyệt. Thao tác ghi bị chặn để ngăn trùng lặp.');
    }
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(record));
    } catch (err) {
      throw new Error(`Không thể lưu khóa chống ghi trùng vào sessionStorage: ${err instanceof Error ? err.message : String(err)}. Thao tác ghi bị chặn để ngăn trùng lặp dữ liệu.`);
    }
  }

  public async computeSignatureHash(method: string, url: string, payload?: unknown): Promise<string> {
    const cleanUrl = url.split('?')[0];
    const bodyStr = payload !== undefined && payload !== null ? JSON.stringify(payload) : '';
    const rawSig = `${method.toUpperCase()}:${cleanUrl}:${bodyStr}`;
    return computeSha256(rawSig);
  }

  public async getOrCreateKey(method: string, url: string, payload?: unknown): Promise<string> {
    const sigHash = await this.computeSignatureHash(method, url, payload);

    // Check memory first
    if (this.inMemoryCache.has(sigHash)) {
      return this.inMemoryCache.get(sigHash)!;
    }

    // Check sessionStorage to survive page reloads
    const storage = this.getStorage();
    if (storage[sigHash]) {
      this.inMemoryCache.set(sigHash, storage[sigHash]);
      return storage[sigHash];
    }

    // Create new UUID
    const newUuid = generateUUID();
    this.inMemoryCache.set(sigHash, newUuid);
    storage[sigHash] = newUuid;
    this.setStorage(storage);
    return newUuid;
  }

  public async invalidate(method: string, url: string, payload?: unknown): Promise<void> {
    const sigHash = await this.computeSignatureHash(method, url, payload);
    this.inMemoryCache.delete(sigHash);
    const storage = this.getStorage();
    if (storage[sigHash]) {
      delete storage[sigHash];
      this.setStorage(storage);
    }
  }

  public clear(): void {
    this.inMemoryCache.clear();
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }
}

export const idempotencyManager = new IdempotencyManager();
