import { sign } from '@tma.js/init-data-node';
import { sql } from 'drizzle-orm';
import { db } from '../src/db/index.ts';
import { materials, priceItems, users } from '../src/db/schema.ts';

export async function resetDb() {
  await db.execute(sql`
    truncate users, price_items, materials, reports, report_participants,
      report_works, report_materials, report_photos restart identity cascade
  `);
}

export async function createUser(name: string, telegramId: number) {
  const [user] = await db.insert(users).values({ name, telegramId }).returning();
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
