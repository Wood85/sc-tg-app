import {
  type AdminMaterialDto,
  type AdminPriceItemDto,
  type AdminUserDto,
  materialInputSchema,
  type PayrollStatementDto,
  type PayrollUserDto,
  priceItemInputSchema,
  userInputSchema,
  type WageRates,
  wageRatesSchema,
} from '@sc/shared';
import { asc, desc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAdmin } from '../auth.ts';
import { bot } from '../bot.ts';
import { db } from '../db/index.ts';
import { materials, priceItems, users } from '../db/schema.ts';
import { HttpError, isForeignKeyViolation, isUniqueViolation, parseOrThrow } from '../errors.ts';
import { listPayrollUsers, listStatements } from '../payroll/service.ts';
import { getWageRates, setWageRates } from '../wages.ts';

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

// Позицию можно удалить, только пока её нет ни в одном отчёте; иначе — скрыть.
// Людей не удаляем, а отключаем.
const priceItemColumns = {
  id: priceItems.id,
  category: priceItems.category,
  name: priceItems.name,
  unit: priceItems.unit,
  price: priceItems.price,
  tiers: priceItems.tiers,
  isActive: priceItems.isActive,
};
const materialColumns = {
  id: materials.id,
  category: materials.category,
  name: materials.name,
  unit: materials.unit,
  isActive: materials.isActive,
};
const userColumns = {
  id: users.id,
  telegramId: users.telegramId,
  name: users.name,
  role: users.role,
  isActive: users.isActive,
};

async function uniqueOr409<T>(action: () => Promise<T>, message: string): Promise<T> {
  try {
    return await action();
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, message);
    throw err;
  }
}

async function deleteUnused(action: () => Promise<unknown[]>, message: string) {
  try {
    const deleted = await action();
    if (deleted.length === 0) throw new HttpError(404, 'Не найдено');
  } catch (err) {
    if (isForeignKeyViolation(err)) throw new HttpError(409, message);
    throw err;
  }
}

function found<T>(row: T | undefined): T {
  if (!row) throw new HttpError(404, 'Не найдено');
  return row;
}

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAdmin);

  app.get('/price-items', async (): Promise<AdminPriceItemDto[]> =>
    db
      .select(priceItemColumns)
      .from(priceItems)
      .orderBy(asc(priceItems.category), desc(priceItems.isActive), asc(priceItems.sortOrder), asc(priceItems.id)),
  );

  app.post('/price-items', async (req, reply): Promise<AdminPriceItemDto> => {
    const input = parseOrThrow(priceItemInputSchema, req.body);
    const [row] = await uniqueOr409(
      () =>
        db
          .insert(priceItems)
          .values({ ...input, sortOrder: sql`(select coalesce(max(sort_order), 0) + 1 from price_items)` })
          .returning(priceItemColumns),
      'Такая работа уже есть в этой категории',
    );
    reply.code(201);
    return found(row);
  });

  app.put('/price-items/:id', async (req): Promise<AdminPriceItemDto> => {
    const { id } = parseOrThrow(paramsSchema, req.params);
    const input = parseOrThrow(priceItemInputSchema, req.body);
    const [row] = await uniqueOr409(
      () => db.update(priceItems).set(input).where(eq(priceItems.id, id)).returning(priceItemColumns),
      'Такая работа уже есть в этой категории',
    );
    return found(row);
  });

  app.delete('/price-items/:id', async (req, reply) => {
    const { id } = parseOrThrow(paramsSchema, req.params);
    await deleteUnused(
      () => db.delete(priceItems).where(eq(priceItems.id, id)).returning({ id: priceItems.id }),
      'Работа уже есть в отчётах — её можно только скрыть',
    );
    return reply.code(204).send();
  });

  app.get('/materials', async (): Promise<AdminMaterialDto[]> =>
    db
      .select(materialColumns)
      .from(materials)
      .orderBy(asc(materials.category), desc(materials.isActive), asc(materials.sortOrder), asc(materials.id)),
  );

  app.post('/materials', async (req, reply): Promise<AdminMaterialDto> => {
    const input = parseOrThrow(materialInputSchema, req.body);
    const [row] = await uniqueOr409(
      () =>
        db
          .insert(materials)
          .values({ ...input, sortOrder: sql`(select coalesce(max(sort_order), 0) + 1 from materials)` })
          .returning(materialColumns),
      'Такой материал уже есть в этой категории',
    );
    reply.code(201);
    return found(row);
  });

  app.put('/materials/:id', async (req): Promise<AdminMaterialDto> => {
    const { id } = parseOrThrow(paramsSchema, req.params);
    const input = parseOrThrow(materialInputSchema, req.body);
    const [row] = await uniqueOr409(
      () => db.update(materials).set(input).where(eq(materials.id, id)).returning(materialColumns),
      'Такой материал уже есть в этой категории',
    );
    return found(row);
  });

  app.delete('/materials/:id', async (req, reply) => {
    const { id } = parseOrThrow(paramsSchema, req.params);
    await deleteUnused(
      () => db.delete(materials).where(eq(materials.id, id)).returning({ id: materials.id }),
      'Материал уже есть в отчётах — его можно только скрыть',
    );
    return reply.code(204).send();
  });

  // Новые ставки применяются к дням, оклад за которые ещё не начислен.
  app.get('/wage-rates', async (): Promise<WageRates> => getWageRates());

  app.put('/wage-rates', async (req): Promise<WageRates> => {
    await setWageRates(parseOrThrow(wageRatesSchema, req.body));
    return getWageRates();
  });

  app.get('/payroll', async (): Promise<PayrollUserDto[]> => listPayrollUsers());

  app.get('/payroll/:id', async (req): Promise<PayrollStatementDto[]> => {
    const { id } = parseOrThrow(paramsSchema, req.params);
    const { limit } = parseOrThrow(z.object({ limit: z.coerce.number().int().min(1).max(52).default(5) }), req.query);
    return listStatements(id, limit);
  });

  app.get('/users', async (): Promise<AdminUserDto[]> =>
    db.select(userColumns).from(users).orderBy(desc(users.isActive), asc(users.name)),
  );

  app.post('/users', async (req, reply): Promise<AdminUserDto> => {
    const input = parseOrThrow(userInputSchema, req.body);
    const [row] = await uniqueOr409(
      () => db.insert(users).values(input).returning(userColumns),
      'Пользователь с таким Telegram ID уже есть',
    );
    const user = found(row);
    // Сообщение дойдёт, только если человек уже писал боту (/start) — так он и узнаёт свой ID.
    bot.api
      .sendMessage(user.telegramId, 'Доступ открыт! Нажмите кнопку «Отчёт» внизу чата, чтобы открыть приложение.')
      .catch((err) => req.log.warn(err, 'Failed to notify new user'));
    reply.code(201);
    return user;
  });

  app.put('/users/:id', async (req): Promise<AdminUserDto> => {
    const { id } = parseOrThrow(paramsSchema, req.params);
    const input = parseOrThrow(userInputSchema, req.body);
    // Иначе админ может случайно запереть сам себя.
    if (id === req.user.id && (input.role !== 'admin' || !input.isActive)) {
      throw new HttpError(400, 'Нельзя снять права администратора или отключить самого себя');
    }
    const [row] = await uniqueOr409(
      () => db.update(users).set(input).where(eq(users.id, id)).returning(userColumns),
      'Пользователь с таким Telegram ID уже есть',
    );
    return found(row);
  });
}
