import type { FastifyInstance } from 'fastify';
import { authenticate } from '../auth.ts';
import { adminRoutes } from './admin.ts';
import { catalogRoutes } from './catalog.ts';
import { meRoutes } from './me.ts';
import { photoRoutes } from './photos.ts';
import { reportRoutes } from './reports.ts';

// Все роуты /api требуют авторизации через initData.
export async function apiRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  await app.register(meRoutes);
  await app.register(catalogRoutes);
  await app.register(reportRoutes);
  await app.register(photoRoutes);
  await app.register(adminRoutes, { prefix: '/admin' });
}
