import type { MeDto } from '@sc/shared';
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../auth.ts';

export async function meRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/me', async (req): Promise<MeDto> => {
    const { id, telegramId, name, role } = req.user;
    return { id, telegramId, name, role };
  });
}
