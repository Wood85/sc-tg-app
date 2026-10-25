import { describe, expect, it } from 'vitest';
import { parseQtyInput } from './qty.ts';

describe('parseQtyInput', () => {
  it('accepts integers and decimals with comma or dot', () => {
    expect(parseQtyInput('2')).toBe(2);
    expect(parseQtyInput('0,3')).toBe(0.3);
    expect(parseQtyInput(' 1.25 ')).toBe(1.25);
  });

  it('rejects empty, zero, negative and over-precise values', () => {
    for (const input of ['', '0', '0,00', '-1', '1,234', 'abc', '1,', ',5']) {
      expect(parseQtyInput(input)).toBeUndefined();
    }
  });
});
