import { earningsQuerySchema, type EarningsDto, type MeDto } from '@sc/shared';
import type { FastifyInstance } from 'fastify';
import { parseOrThrow } from '../errors.ts';
import { getEarnings } from '../reports/service.ts';

export async function meRoutes(app: FastifyInstance) {
  app.get('/me', async (req): Promise<MeDto> => {
    const { id, telegramId, name, role } = req.user;
    return { id, telegramId, name, role };
  });

  app.get('/me/earnings', async (req): Promise<EarningsDto> => {
    const { from, to } = parseOrThrow(earningsQuerySchema, req.query);
    return getEarnings(req.user.id, from, to);
  });
}
