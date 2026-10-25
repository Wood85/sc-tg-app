import { defineConfig } from 'vitest/config';

export const TEST_DATABASE_URL = 'postgres://sc:sc@localhost:5432/sc_test';

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      BOT_TOKEN: '123456:test-bot-token',
      DATABASE_URL: TEST_DATABASE_URL,
      GROUP_CHAT_ID: '-1001',
    },
    globalSetup: './test/global-setup.ts',
    // Интеграционные тесты делят одну базу.
    fileParallelism: false,
  },
});
