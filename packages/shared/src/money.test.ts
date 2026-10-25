import { describe, expect, it } from 'vitest';
import { formatMoneyInput, lineAmount, parseMoneyInput, reportTotal, splitEqually, tierPrice } from './money.ts';

describe('lineAmount', () => {
  it('multiplies fractional quantities without float drift', () => {
    expect(lineAmount(0.3, 1500)).toBe(450);
    expect(lineAmount(0.29, 100)).toBe(29);
    expect(lineAmount(2, 4999)).toBe(9998);
  });
});

describe('splitEqually', () => {
  it('gives the remainder to the first participant', () => {
    expect(splitEqually(100_000, 3)).toEqual([33_334, 33_333, 33_333]);
  });

  it('always sums back to the total', () => {
    for (const [total, n] of [[1, 3], [99_999, 7], [0, 2]] as const) {
      expect(splitEqually(total, n).reduce((a, b) => a + b, 0)).toBe(total);
    }
  });
});

describe('parseMoneyInput', () => {
  it('converts lari to tetri', () => {
    expect(parseMoneyInput('25')).toBe(2500);
    expect(parseMoneyInput('25,5')).toBe(2550);
    expect(parseMoneyInput('1 250,99')).toBe(125_099);
    expect(parseMoneyInput('0')).toBe(0);
  });

  it('rejects malformed input', () => {
    for (const input of ['', '-5', '1,234', 'abc', '1,']) expect(parseMoneyInput(input)).toBeUndefined();
  });

  it('round-trips with formatMoneyInput', () => {
    for (const tetri of [0, 5, 2500, 2550, 125_099]) {
      expect(parseMoneyInput(formatMoneyInput(tetri))).toBe(tetri);
    }
  });
});

describe('tierPrice', () => {
  // Закладка трасс: до 6 м — 8 ₾, 7–10 м — 7 ₾, 11–20 м — 6,5 ₾, больше — 6 ₾.
  const tiers = [
    { upTo: 6, price: 800 },
    { upTo: 10, price: 700 },
    { upTo: 20, price: 650 },
    { upTo: null, price: 600 },
  ];

  it('picks the tier by total quantity, boundaries inclusive', () => {
    expect(tierPrice(tiers, 0.5)).toBe(800);
    expect(tierPrice(tiers, 6)).toBe(800);
    expect(tierPrice(tiers, 6.5)).toBe(700);
    expect(tierPrice(tiers, 10)).toBe(700);
    expect(tierPrice(tiers, 20)).toBe(650);
    expect(tierPrice(tiers, 500)).toBe(600);
  });
});

describe('reportTotal', () => {
  it('applies the 1.2 height coefficient to the whole report', () => {
    expect(reportTotal([1000, 2333], false)).toBe(3333);
    expect(reportTotal([1000, 2333], true)).toBe(4000);
    expect(reportTotal([1], true)).toBe(1);
  });
});
