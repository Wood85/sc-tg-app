import { sign } from '@tma.js/init-data-node';
import { sql } from 'drizzle-orm';
import { bot } from '../src/bot.ts';
import { db } from '../src/db/index.ts';
import { materials, priceItems, users } from '../src/db/schema.ts';

export async function resetDb() {
  await db.execute(sql`
    truncate users, price_items, materials, reports, report_participants,
      report_works, report_materials, report_photos restart identity cascade
  `);
}

export async function createUser(name: string, telegramId: number, role: 'installer' | 'admin' = 'installer') {
  const [user] = await db.insert(users).values({ name, telegramId, role }).returning();
  return user!;
}

export async function createCatalog() {
  const [blocks, drilling] = await db
    .insert(priceItems)
    .values([
      { category: 'conditioning', name: 'Монтаж блоков', unit: 'шт', price: 5000 },
      { category: 'ventilation', name: 'Отверстие под приточку ⌀100', unit: 'шт', price: 3333 },
    ])
    .returning();
  const [pipe] = await db
    .insert(materials)
    .values([{ category: 'ventilation', name: 'Труба ⌀110', unit: 'м' }])
    .returning();
  return { blocks: blocks!, drilling: drilling!, pipe: pipe! };
}

export function authHeader(telegramId: number) {
  const initData = sign({ user: { id: telegramId, first_name: 'Test' } }, process.env.BOT_TOKEN!, new Date());
  return { authorization: `tma ${initData}` };
}

// Вместо Telegram запоминаем отправленные сообщения. Вызывать один раз на файл тестов.
export function mockTelegram() {
  const state = { sent: [] as { chat_id: number; text: string }[], down: false };
  bot.api.config.use(async (prev, method, payload, signal) => {
    if (method !== 'sendMessage') return prev(method, payload, signal);
    if (state.down) return { ok: false, error_code: 400, description: 'Bad Request: chat not found' } as never;
    state.sent.push(payload as { chat_id: number; text: string });
    return { ok: true, result: { message_id: 100 + state.sent.length } } as never;
  });
  return state;
}
