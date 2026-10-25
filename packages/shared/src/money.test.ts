import { describe, expect, it } from 'vitest';
import { lineAmount, splitEqually } from './money.ts';

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
