import { DEFAULT_WAGE_RATES, type WageRates } from '@sc/shared';
import { inArray, sql } from 'drizzle-orm';
import { db } from './db/index.ts';
import { settings } from './db/schema.ts';

type Db = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

const keys = { weekday: 'wage_weekday', weekend: 'wage_weekend' } as const;

// Ставки дневного оклада; пока админ их не менял — значения по умолчанию (70 / 100 ₾).
export async function getWageRates(conn: Db = db): Promise<WageRates> {
  const rows = await conn
    .select()
    .from(settings)
    .where(inArray(settings.key, Object.values(keys)));
  const value = (key: string) => rows.find((r) => r.key === key)?.value;
  return {
    weekday: value(keys.weekday) ?? DEFAULT_WAGE_RATES.weekday,
    weekend: value(keys.weekend) ?? DEFAULT_WAGE_RATES.weekend,
  };
}

export async function setWageRates(rates: WageRates): Promise<void> {
  await db
    .insert(settings)
    .values([
      { key: keys.weekday, value: rates.weekday },
      { key: keys.weekend, value: rates.weekend },
    ])
    .onConflictDoUpdate({ target: settings.key, set: { value: sql`excluded.value` } });
}
