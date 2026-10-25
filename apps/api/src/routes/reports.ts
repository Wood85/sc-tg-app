import { reportDraftSchema, type ReportDto, type ReportListItemDto } from '@sc/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseOrThrow } from '../errors.ts';
import {
  createReport,
  deleteReport,
  getReport,
  listReports,
  sendReport,
  updateReport,
} from '../reports/service.ts';

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

export async function reportRoutes(app: FastifyInstance) {
  app.get('/reports', async (req): Promise<ReportListItemDto[]> => listReports(req.user.id));

  app.post('/reports', async (req, reply): Promise<ReportDto> => {
    const input = parseOrThrow(reportDraftSchema, req.body);
    const id = await createReport(req.user.id, input);
    reply.code(201);
    return getReport(req.user.id, id);
  });

  app.get('/reports/:id', async (req): Promise<ReportDto> => {
    const { id } = parseOrThrow(paramsSchema, req.params);
    return getReport(req.user.id, id);
  });

  app.put('/reports/:id', async (req): Promise<ReportDto> => {
    const { id } = parseOrThrow(paramsSchema, req.params);
    const input = parseOrThrow(reportDraftSchema, req.body);
    await updateReport(req.user.id, id, input);
    return getReport(req.user.id, id);
  });

  app.delete('/reports/:id', async (req, reply) => {
    const { id } = parseOrThrow(paramsSchema, req.params);
    await deleteReport(req.user.id, id);
    return reply.code(204).send();
  });

  app.post('/reports/:id/send', async (req): Promise<ReportDto> => {
    const { id } = parseOrThrow(paramsSchema, req.params);
    return sendReport(req.user.id, id);
  });
}
