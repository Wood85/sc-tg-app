import multipart from '@fastify/multipart';
import Fastify from 'fastify';
import { apiRoutes } from './routes/index.ts';

export async function buildApp({ logger = true }: { logger?: boolean } = {}) {
  const app = Fastify({ logger });
  app.decorateRequest('user');
  // Одно фото на запрос; клиент сжимает их примерно до 300 КБ.
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

  app.get('/health', async () => ({ ok: true }));
  await app.register(apiRoutes, { prefix: '/api' });

  return app;
}
