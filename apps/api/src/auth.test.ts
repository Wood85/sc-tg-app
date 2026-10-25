import { sign } from '@tma.js/init-data-node';
import { describe, expect, it } from 'vitest';

process.env.BOT_TOKEN ??= 'test-token';
process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
const { telegramIdFromInitData } = await import('./auth.ts');

const token = '123456:test-bot-token';
const user = { id: 42, first_name: 'Иван' };

describe('telegramIdFromInitData', () => {
  it('accepts init data signed with the bot token', () => {
    const raw = sign({ user }, token, new Date());
    expect(telegramIdFromInitData(raw, token)).toBe(42);
  });

  it('rejects init data signed with another token', () => {
    const raw = sign({ user }, '999:other-token', new Date());
    expect(telegramIdFromInitData(raw, token)).toBeUndefined();
  });

  it('rejects tampered init data', () => {
    const raw = sign({ user }, token, new Date()).replace('42', '43');
    expect(telegramIdFromInitData(raw, token)).toBeUndefined();
  });

  it('rejects expired init data', () => {
    const raw = sign({ user }, token, new Date(Date.now() - 2 * 24 * 60 * 60 * 1000));
    expect(telegramIdFromInitData(raw, token)).toBeUndefined();
  });
});
