export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Cache that maps an action signature (method + url + normalized body)
 * to its assigned idempotency UUID.
 *
 * This guarantees:
 * - A retry of the EXACT SAME payload reuses the same Idempotency-Key UUID.
 * - Changing the payload (e.g., user edits a field) produces a new UUID.
 * - Completed successful mutations can release the key.
 */
class IdempotencyManager {
  private keyMap = new Map<string, { uuid: string; timestamp: number }>();
  private readonly ttlMs = 15 * 60 * 1000; // 15 minutes TTL

  private computeSignature(method: string, url: string, payload?: unknown): string {
    const cleanUrl = url.split('?')[0];
    const bodyStr = payload ? JSON.stringify(payload) : '';
    return `${method.toUpperCase()}:${cleanUrl}:${bodyStr}`;
  }

  public getOrCreateKey(method: string, url: string, payload?: unknown): string {
    const sig = this.computeSignature(method, url, payload);
    const existing = this.keyMap.get(sig);
    const now = Date.now();

    if (existing && now - existing.timestamp < this.ttlMs) {
      return existing.uuid;
    }

    const newUuid = generateUUID();
    this.keyMap.set(sig, { uuid: newUuid, timestamp: now });
    return newUuid;
  }

  public invalidate(method: string, url: string, payload?: unknown): void {
    const sig = this.computeSignature(method, url, payload);
    this.keyMap.delete(sig);
  }

  public clear(): void {
    this.keyMap.clear();
  }
}

export const idempotencyManager = new IdempotencyManager();
