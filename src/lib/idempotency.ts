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
 */
export async function computeSha256(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Simple deterministic fallback for non-crypto test runners
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return `fallback-${Math.abs(hash).toString(16)}`;
}

/**
 * IdempotencyManager:
 * - Computes SHA-256 signature for each mutating request (method + url + normalized body)
 * - Retains assigned Idempotency-Key UUID across page reloads in sessionStorage
 * - NO TTL: keys are retained until server confirms receipt and parsing succeeds,
 *   preventing duplicate financial / inventory records on uncertain reloads.
 * - Cleared upon parsed success or explicit user logout.
 */
class IdempotencyManager {
  private inMemoryCache = new Map<string, string>();

  private getStorage(): Record<string, string> {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const item = window.sessionStorage.getItem(STORAGE_KEY);
        return item ? JSON.parse(item) : {};
      }
    } catch {
      // sessionStorage might be restricted in some sandboxes
    }
    return {};
  }

  private setStorage(record: Record<string, string>): void {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(record));
      }
    } catch {
      // ignore storage quota / sandbox errors
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
