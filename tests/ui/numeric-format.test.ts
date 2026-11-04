import { describe, it, expect } from 'vitest';
import { formatNumber, formatVND } from '../../src/lib/formatters';

describe('Numeric Input Formatting and Validation', () => {
  it('formats numbers with Vietnamese dot thousands separators correctly', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(150)).toBe('150');
    expect(formatNumber(15000)).toBe('15.000');
    expect(formatNumber(15000000)).toBe('15.000.000');
    expect(formatNumber('2500000')).toBe('2.500.000');
    expect(formatVND(15000000)).toBe('15.000.000 ₫');
  });

  it('handles blank values safely without crashing or emitting NaN', () => {
    expect(formatNumber('')).toBe('0');
    expect(formatNumber(null)).toBe('0');
    expect(formatNumber(undefined)).toBe('0');
    expect(formatVND('')).toBe('0 ₫');
  });

  it('cleans non-digit input into raw digits for state/onChange', () => {
    const rawPastedWithDots = '15.000.000'.replace(/\D/g, '');
    expect(rawPastedWithDots).toBe('15000000');
    expect(parseInt(rawPastedWithDots, 10)).toBe(15000000);

    const emptyRaw = ''.replace(/\D/g, '');
    expect(emptyRaw).toBe('');
    expect(Math.max(0, parseInt(emptyRaw || '0', 10))).toBe(0);
  });

  it('clamps values against outstanding bounds safely', () => {
    const outstandingDebt = 5000000;
    const clamp = (valStr: string) =>
      Math.min(outstandingDebt, Math.max(0, parseInt(valStr.replace(/\D/g, '') || '0', 10)));

    expect(clamp('3000000')).toBe(3000000);
    expect(clamp('8000000')).toBe(5000000);
    expect(clamp('')).toBe(0);
  });
});
