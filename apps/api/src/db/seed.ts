// Заполняет справочники из CSV и создаёт администраторов из ADMIN_TELEGRAM_IDS.
// Можно запускать повторно: существующие записи обновляются.
//
// seed/price_items.csv: category;name;unit;price;tiers   (цена в лари, «25» или «25,50»)
//   tiers — необязательные ступени по количеству: «6:8|10:7|*:6» = до 6 — 8 ₾, до 10 — 7 ₾, больше — 6 ₾
//   addon — необязательная доплата: «Оклейка в изоляцию:1» = +1 ₾ за единицу
// seed/materials.csv:   category;name;unit
// Разделитель «;» (так сохраняет Excel) или «,». Категория: «Кондиционирование» / «Вентиляция».
import {
  type Category,
  categories,
  categoryLabels,
  type PriceAddon,
  type PriceTier,
  priceTiersSchema,
} from '@sc/shared';
import { sql } from 'drizzle-orm';
import { existsSync, readFileSync } from 'node:fs';
import { env } from '../env.ts';
import { client, db } from './index.ts';
import { materials, priceItems, users } from './schema.ts';

const seedDir = new URL('../../seed/', import.meta.url);

function readCsv(file: string): Record<string, string>[] | undefined {
  const url = new URL(file, seedDir);
  if (!existsSync(url)) return undefined;
  const lines = readFileSync(url, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const delimiter = lines[0]?.includes(';') ? ';' : ',';
  const split = (line: string) => line.split(delimiter).map((c) => c.trim().replace(/^"(.*)"$/, '$1'));
  const [header = [], ...rows] = lines.map(split);
  return rows.map((row) => Object.fromEntries(header.map((key, i) => [key, row[i] ?? ''])));
}

function parseCategory(value: string, line: number): Category {
  const v = value.toLowerCase();
  const found = categories.find((c) => c === v || categoryLabels[c].toLowerCase() === v);
  if (!found) throw new Error(`Line ${line}: unknown category "${value}"`);
  return found;
}

function parsePrice(value: string, line: number): number {
  const lari = Number(value.replace(',', '.').replace(/\s/g, ''));
  if (!Number.isFinite(lari) || lari < 0) throw new Error(`Line ${line}: invalid price "${value}"`);
  return Math.round(lari * 100);
}

function parseTiers(value: string, line: number): PriceTier[] | null {
  if (!value.trim()) return null;
  const tiers = value.split('|').map((part) => {
    const [upTo = '', price = ''] = part.split(':').map((s) => s.trim());
    return { upTo: upTo === '*' ? null : Number(upTo.replace(',', '.')), price: parsePrice(price, line) };
  });
  const result = priceTiersSchema.safeParse(tiers);
  if (!result.success) throw new Error(`Line ${line}: invalid tiers "${value}"`);
  return result.data;
}

function parseAddon(value: string, line: number): PriceAddon | null {
  if (!value.trim()) return null;
  const separator = value.lastIndexOf(':');
  const name = value.slice(0, separator).trim();
  if (separator < 1 || !name) throw new Error(`Line ${line}: invalid addon "${value}"`);
  return { name, price: parsePrice(value.slice(separator + 1), line) };
}

for (const telegramId of env.ADMIN_TELEGRAM_IDS) {
  await db
    .insert(users)
    .values({ telegramId, name: `Администратор ${telegramId}`, role: 'admin' })
    .onConflictDoUpdate({ target: users.telegramId, set: { role: 'admin', isActive: true } });
}
console.log(`Admins: ${env.ADMIN_TELEGRAM_IDS.length}`);

const priceRows = readCsv('price_items.csv');
if (priceRows) {
  for (const [i, row] of priceRows.entries()) {
    const line = i + 2;
    const tiers = parseTiers(row.tiers ?? '', line);
    await db
      .insert(priceItems)
      .values({
        category: parseCategory(row.category ?? '', line),
        name: row.name ?? '',
        unit: row.unit ?? '',
        price: tiers ? tiers[0]!.price : parsePrice(row.price ?? '', line),
        tiers,
        addon: parseAddon(row.addon ?? '', line),
        sortOrder: i,
      })
      .onConflictDoUpdate({
        target: [priceItems.category, priceItems.name],
        set: {
          unit: sql`excluded.unit`,
          price: sql`excluded.price`,
          tiers: sql`excluded.tiers`,
          addon: sql`excluded.addon`,
          sortOrder: sql`excluded.sort_order`,
        },
      });
  }
  console.log(`Price items: ${priceRows.length}`);
} else {
  console.log('seed/price_items.csv not found, skipped (see price_items.example.csv)');
}

const materialRows = readCsv('materials.csv');
if (materialRows) {
  for (const [i, row] of materialRows.entries()) {
    await db
      .insert(materials)
      .values({ category: parseCategory(row.category ?? '', i + 2), name: row.name ?? '', unit: row.unit ?? '', sortOrder: i })
      .onConflictDoUpdate({
        target: [materials.category, materials.name],
        set: { unit: sql`excluded.unit`, sortOrder: sql`excluded.sort_order` },
      });
  }
  console.log(`Materials: ${materialRows.length}`);
} else {
  console.log('seed/materials.csv not found, skipped (see materials.example.csv)');
}

await client.end();
