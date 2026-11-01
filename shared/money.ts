const maxVnd = BigInt(Number.MAX_SAFE_INTEGER);

function integer(value: number): bigint {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Giá trị phải là số nguyên không âm an toàn.');
  return BigInt(value);
}

function number(value: bigint): number {
  if (value < 0n || value > maxVnd) throw new RangeError('Số tiền vượt giới hạn cho phép.');
  return Number(value);
}

export function sumVnd(values: readonly number[]): number {
  return number(values.reduce((sum, value) => sum + integer(value), 0n));
}

export function multiplyVnd(amount: number, quantity: number): number {
  return number(integer(amount) * integer(quantity));
}

export function allocateDiscount(discount: number, grossLines: readonly number[]): number[] {
  const budget = integer(discount);
  const weights = grossLines.map(integer);
  const total = weights.reduce((sum, weight) => sum + weight, 0n);
  if (budget > total) throw new RangeError('Chiết khấu vượt tổng tiền hàng.');
  if (total === 0n) return grossLines.map(() => 0);
  const allocated = weights.map(weight => budget * weight / total);
  let remainder = budget - allocated.reduce((sum, value) => sum + value, 0n);
  for (let index = 0; remainder > 0n && index < allocated.length; index++) {
    if (allocated[index] < weights[index]) { allocated[index]++; remainder--; }
  }
  return allocated.map(number);
}

export function partialReturnVnd(netLine: number, quantity: number, alreadyReturned: number, returning: number): number {
  const net = integer(netLine);
  const total = integer(quantity);
  const before = integer(alreadyReturned);
  const count = integer(returning);
  if (total === 0n || count === 0n || before + count > total) throw new RangeError('Số lượng trả không hợp lệ.');
  return number(net * (before + count) / total - net * before / total);
}
