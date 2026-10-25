import Fastify from 'fastify';
import { apiRoutes } from './routes/index.ts';

export async function buildApp({ logger = true }: { logger?: boolean } = {}) {
  const app = Fastify({ logger });
  app.decorateRequest('user');

  app.get('/health', async () => ({ ok: true }));
  await app.register(apiRoutes, { prefix: '/api' });

  return app;
}
