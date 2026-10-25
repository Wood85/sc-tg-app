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

interface MediaCall {
  method: 'sendPhoto' | 'sendMediaGroup';
  chat_id: number;
  photos: number;
  caption?: string;
}

// Вместо Telegram запоминаем отправленные сообщения и фото. Вызывать один раз на файл тестов.
export function mockTelegram() {
  const state = { sent: [] as { chat_id: number; text: string }[], media: [] as MediaCall[], down: false };
  let messageId = 100;
  const photoMessage = () => ({ message_id: ++messageId, photo: [{ file_id: `small-${messageId}` }, { file_id: `file-${messageId}` }] });

  bot.api.config.use(async (prev, method, payload, signal) => {
    if (!['sendMessage', 'sendPhoto', 'sendMediaGroup'].includes(method)) return prev(method, payload, signal);
    if (state.down) return { ok: false, error_code: 400, description: 'Bad Request: chat not found' } as never;

    if (method === 'sendMessage') {
      state.sent.push(payload as { chat_id: number; text: string });
      return { ok: true, result: { message_id: ++messageId } } as never;
    }
    if (method === 'sendPhoto') {
      const p = payload as { chat_id: number; caption?: string };
      state.media.push({ method, chat_id: p.chat_id, photos: 1, caption: p.caption });
      return { ok: true, result: photoMessage() } as never;
    }
    const p = payload as { chat_id: number; media: { caption?: string }[] };
    state.media.push({ method: 'sendMediaGroup', chat_id: p.chat_id, photos: p.media.length, caption: p.media[0]?.caption });
    return { ok: true, result: p.media.map(photoMessage) } as never;
  });
  return state;
}

// Минимальный «JPEG»: сервер проверяет только сигнатуру файла.
export const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

export function multipartBody(data: Buffer, mimetype = 'image/jpeg') {
  const boundary = 'test-boundary';
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="photo.jpg"\r\nContent-Type: ${mimetype}\r\n\r\n`),
    data,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { payload: body, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}
