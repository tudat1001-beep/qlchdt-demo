import { describe, expect, it } from 'vitest';
import { allocateDiscount, multiplyVnd, partialReturnVnd, sumSignedVnd, sumVnd } from '../shared/money.js';

describe('SOL financial invariants', () => {
  it('keeps every discount dong, handles zero-value lines and cannot make a line negative', () => {
    for (let first = 0; first <= 9; first++) for (let second = 0; second <= 9; second++) {
      const weights = [0, first, second, 1];
      for (let discount = 0; discount <= first + second + 1; discount++) {
        const allocation = allocateDiscount(discount, weights);
        expect(sumVnd(allocation)).toBe(discount);
        allocation.forEach((value, index) => expect(value >= 0 && value <= weights[index]).toBe(true));
      }
    }
    expect(allocateDiscount(0, [0, 0])).toEqual([0, 0]);
    expect(allocateDiscount(0, [])).toEqual([]);
    expect(() => allocateDiscount(1, [0])).toThrow(RangeError);
    expect(allocateDiscount(Number.MAX_SAFE_INTEGER, [Number.MAX_SAFE_INTEGER, 1]))
      .toEqual([Number.MAX_SAFE_INTEGER, 0]);
  });

  it('returns the same net total in separate pieces as in one return', () => {
    for (let quantity = 1; quantity <= 25; quantity++) for (let net = 0; net <= 100; net++) {
      let refunded = 0;
      for (let returned = 0; returned < quantity; returned++) refunded += partialReturnVnd(net, quantity, returned, 1);
      expect(refunded).toBe(net);
      expect(partialReturnVnd(net, quantity, 0, quantity)).toBe(net);
    }
    const max = Number.MAX_SAFE_INTEGER;
    expect(sumVnd([partialReturnVnd(max, 3, 0, 1), partialReturnVnd(max, 3, 1, 2)])).toBe(max);
    expect(() => partialReturnVnd(100, 3, 2, 2)).toThrow(RangeError);
    expect(() => partialReturnVnd(100, 0, 0, 1)).toThrow(RangeError);
  });

  it('rejects invalid money and overflow rather than rounding', () => {
    expect(multiplyVnd(100001, 3)).toBe(300003);
    expect(sumVnd([Number.MAX_SAFE_INTEGER - 1, 1])).toBe(Number.MAX_SAFE_INTEGER);
    for (const value of [-1, 0.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => sumVnd([value])).toThrow(RangeError);
      expect(() => multiplyVnd(value, 1)).toThrow(RangeError);
    }
    expect(() => multiplyVnd(Number.MAX_SAFE_INTEGER, 2)).toThrow(RangeError);
    expect(() => sumVnd([Number.MAX_SAFE_INTEGER, 1])).toThrow(RangeError);
  });

  it('sums signed cash balances exactly and rejects unsafe totals', () => {
    expect(sumSignedVnd([-422_800_000, 18_000_000])).toBe(-404_800_000);
    expect(() => sumSignedVnd([Number.MAX_SAFE_INTEGER, 1])).toThrow(RangeError);
  });
});
