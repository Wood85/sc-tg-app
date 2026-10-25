import { categories, type PayrollDay, type PriceTier, reportStatuses, roles } from '@sc/shared';
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// Все суммы — integer в тетри (1 ₾ = 100 тетри).

export const roleEnum = pgEnum('role', roles);
export const categoryEnum = pgEnum('category', categories);
export const reportStatusEnum = pgEnum('report_status', reportStatuses);

const id = () => integer().primaryKey().generatedAlwaysAsIdentity();
const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const qty = () => numeric({ precision: 10, scale: 2, mode: 'number' }).notNull();

export const users = pgTable('users', {
  id: id(),
  telegramId: bigint({ mode: 'number' }).notNull().unique(),
  name: text().notNull(),
  role: roleEnum().notNull().default('installer'),
  isActive: boolean().notNull().default(true),
  createdAt: createdAt(),
});

export const priceItems = pgTable(
  'price_items',
  {
    id: id(),
    category: categoryEnum().notNull(),
    name: text().notNull(),
    unit: text().notNull(),
    price: integer().notNull(),
    // Ступенчатая цена по общему количеству в отчёте; null — обычная цена.
    tiers: jsonb().$type<PriceTier[]>(),
    isActive: boolean().notNull().default(true),
    sortOrder: integer().notNull().default(0),
  },
  (t) => [uniqueIndex().on(t.category, t.name)],
);

export const materials = pgTable(
  'materials',
  {
    id: id(),
    category: categoryEnum().notNull(),
    name: text().notNull(),
    unit: text().notNull(),
    isActive: boolean().notNull().default(true),
    sortOrder: integer().notNull().default(0),
  },
  (t) => [uniqueIndex().on(t.category, t.name)],
);

export const reports = pgTable(
  'reports',
  {
    id: id(),
    authorId: integer()
      .notNull()
      .references(() => users.id),
    address: text().notNull(),
    location: text().notNull().default(''),
    workDate: date({ mode: 'string' }).notNull(),
    comment: text().notNull().default(''),
    atHeight: boolean().notNull().default(false),
    status: reportStatusEnum().notNull().default('draft'),
    totalAmount: integer().notNull().default(0),
    tgMessageIds: integer().array().notNull().default(sql`'{}'`),
    createdAt: createdAt(),
    sentAt: timestamp({ withTimezone: true }),
  },
  (t) => [index().on(t.authorId, t.workDate), index().on(t.address)],
);

// Доля каждого участника фиксируется при отправке отчёта.
export const reportParticipants = pgTable(
  'report_participants',
  {
    reportId: integer()
      .notNull()
      .references(() => reports.id, { onDelete: 'cascade' }),
    userId: integer()
      .notNull()
      .references(() => users.id),
    amount: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.reportId, t.userId] }), index().on(t.userId)],
);

export const reportWorks = pgTable('report_works', {
  id: id(),
  reportId: integer()
    .notNull()
    .references(() => reports.id, { onDelete: 'cascade' }),
  priceItemId: integer()
    .notNull()
    .references(() => priceItems.id),
  qty: qty(),
  // Цена на момент отчёта: изменения прайса не пересчитывают старые отчёты.
  unitPriceSnapshot: integer().notNull(),
  amount: integer().notNull(),
});

export const reportMaterials = pgTable('report_materials', {
  id: id(),
  reportId: integer()
    .notNull()
    .references(() => reports.id, { onDelete: 'cascade' }),
  materialId: integer()
    .notNull()
    .references(() => materials.id),
  qty: qty(),
});

// Фото загружаются до сохранения отчёта, поэтому reportId может быть пустым.
// Фото без отчёта (не прикреплённые или от удалённого черновика) удаляет очистка.
export const reportPhotos = pgTable(
  'report_photos',
  {
    id: id(),
    reportId: integer().references(() => reports.id, { onDelete: 'set null' }),
    uploaderId: integer()
      .notNull()
      .references(() => users.id),
    storageKey: text().notNull(),
    tgFileId: text(),
    sortOrder: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.reportId)],
);

// Настройки, которые меняет админ (сейчас — ставки дневного оклада, в тетри).
export const settings = pgTable('settings', {
  key: text().primaryKey(),
  value: integer().notNull(),
});

// Начисленный дневной оклад: один на человека за дату работ. Ставка фиксируется
// при отправке первого отчёта за день, поэтому смена ставок не меняет прошлые дни.
export const dailyWages = pgTable(
  'daily_wages',
  {
    userId: integer()
      .notNull()
      .references(() => users.id),
    workDate: date({ mode: 'string' }).notNull(),
    amount: integer().notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.workDate] })],
);

// Недельный отчёт на выплату. Один на человека за неделю; повторная отправка его обновляет.
// days — снимок на момент отправки: админ видит ровно то, что ему прислали.
export const payrollStatements = pgTable(
  'payroll_statements',
  {
    id: id(),
    userId: integer()
      .notNull()
      .references(() => users.id),
    weekStart: date({ mode: 'string' }).notNull(),
    total: integer().notNull(),
    days: jsonb().$type<PayrollDay[]>().notNull(),
    sentAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex().on(t.userId, t.weekStart)],
);

export type User = typeof users.$inferSelect;
