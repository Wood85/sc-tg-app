import type { CatalogDto, UserBriefDto } from '@sc/shared';
import { asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.ts';
import { materials, priceItems, users } from '../db/schema.ts';

export async function catalogRoutes(app: FastifyInstance) {
  app.get('/catalog', async (): Promise<CatalogDto> => {
    const [items, mats] = await Promise.all([
      db
        .select({
          id: priceItems.id,
          category: priceItems.category,
          name: priceItems.name,
          unit: priceItems.unit,
          price: priceItems.price,
        })
        .from(priceItems)
        .where(eq(priceItems.isActive, true))
        .orderBy(asc(priceItems.category), asc(priceItems.sortOrder), asc(priceItems.id)),
      db
        .select({ id: materials.id, category: materials.category, name: materials.name, unit: materials.unit })
        .from(materials)
        .where(eq(materials.isActive, true))
        .orderBy(asc(materials.category), asc(materials.sortOrder), asc(materials.id)),
    ]);
    return { priceItems: items, materials: mats };
  });

  // Для выбора участников бригады.
  app.get('/users', async (): Promise<UserBriefDto[]> =>
    db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.isActive, true))
      .orderBy(asc(users.name)),
  );
}
