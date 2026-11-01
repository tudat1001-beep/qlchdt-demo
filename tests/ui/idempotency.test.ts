import { describe, it, expect, beforeEach } from 'vitest';
import { idempotencyManager, computeSha256 } from '../../src/lib/idempotency';

describe('IdempotencyManager & SHA-256 hashing', () => {
  beforeEach(() => {
    idempotencyManager.clear();
  });

  it('tạo mã SHA-256 chuẩn không chứa payload PII dạng thô', async () => {
    const hash1 = await computeSha256('POST:/products:{"sku":"IP15"}');
    const hash2 = await computeSha256('POST:/products:{"sku":"IP15"}');
    const hashDiff = await computeSha256('POST:/products:{"sku":"IP16"}');

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
    expect(hash1).not.toBe(hashDiff);
  });

  it('bảo toàn cùng một Idempotency-Key UUID khi gửi lại cùng một payload (chống thực thi kép)', async () => {
    const payload = { name: 'Khách hàng A', phone: '0912345678' };
    const key1 = await idempotencyManager.getOrCreateKey('POST', '/customers', payload);
    const key2 = await idempotencyManager.getOrCreateKey('POST', '/customers', payload);

    expect(key1).toBe(key2);
    expect(key1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('đổi mới UUID khi payload thay đổi (người dùng chỉnh sửa dữ liệu)', async () => {
    const payload1 = { name: 'Khách hàng A', phone: '0912345678' };
    const payload2 = { name: 'Khách hàng A Đã sửa', phone: '0912345678' };

    const key1 = await idempotencyManager.getOrCreateKey('POST', '/customers', payload1);
    const key2 = await idempotencyManager.getOrCreateKey('POST', '/customers', payload2);

    expect(key1).not.toBe(key2);
  });

  it('giải phóng khóa sau khi giao dịch hoàn tất thành công', async () => {
    const payload = { sku: 'SP-TEST', name: 'Sản phẩm thử nghiệm' };
    const key1 = await idempotencyManager.getOrCreateKey('POST', '/products', payload);

    await idempotencyManager.invalidate('POST', '/products', payload);
    const key2 = await idempotencyManager.getOrCreateKey('POST', '/products', payload);

    expect(key1).not.toBe(key2);
  });

  it('xóa toàn bộ khóa phiên khi đăng xuất (clear)', async () => {
    await idempotencyManager.getOrCreateKey('POST', '/suppliers', { name: 'NCC 1' });
    idempotencyManager.clear();

    const newKey = await idempotencyManager.getOrCreateKey('POST', '/suppliers', { name: 'NCC 1' });
    expect(newKey).toBeDefined();
  });

  it('báo lỗi rõ ràng và chặn thao tác khi crypto.subtle không khả dụng', async () => {
    const originalSubtle = globalThis.crypto.subtle;
    try {
      Object.defineProperty(globalThis.crypto, 'subtle', { value: undefined, configurable: true, writable: true });
      await expect(computeSha256('test')).rejects.toThrow('crypto.subtle');
    } finally {
      Object.defineProperty(globalThis.crypto, 'subtle', { value: originalSubtle, configurable: true, writable: true });
    }
  });

  it('báo lỗi rõ ràng và chặn thao tác khi sessionStorage bị lỗi (ngăn chặn nhận vờ an toàn)', async () => {
    const originalSessionStorage = (globalThis as unknown as { sessionStorage?: unknown }).sessionStorage;
    try {
      const failingStorage = {
        getItem: () => { throw new Error('QuotaExceeded'); },
        setItem: () => { throw new Error('QuotaExceeded'); },
        removeItem: () => {},
        clear: () => {},
        length: 0,
        key: () => null,
      };
      Object.defineProperty(globalThis, 'sessionStorage', { value: failingStorage, configurable: true, writable: true });
      await expect(idempotencyManager.getOrCreateKey('POST', '/test', { a: 1 })).rejects.toThrow('sessionStorage');
    } finally {
      if (originalSessionStorage !== undefined) {
        Object.defineProperty(globalThis, 'sessionStorage', { value: originalSessionStorage, configurable: true, writable: true });
      } else {
        // @ts-expect-error cleanup mock
        delete globalThis.sessionStorage;
      }
    }
  });
});
