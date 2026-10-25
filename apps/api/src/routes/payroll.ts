import { type PayrollSendResultDto, type PayrollStatementDto, payrollSendSchema } from '@sc/shared';
import type { FastifyInstance } from 'fastify';
import { parseOrThrow } from '../errors.ts';
import { listStatements, sendPayroll } from '../payroll/service.ts';

export async function payrollRoutes(app: FastifyInstance) {
  // Мои отправленные недельные отчёты — чтобы показать статус недели.
  app.get('/payroll', async (req): Promise<PayrollStatementDto[]> => listStatements(req.user.id, 10));

  app.post('/payroll', async (req): Promise<PayrollSendResultDto> => {
    const { weekStart } = parseOrThrow(payrollSendSchema, req.body);
    return sendPayroll(req.user, weekStart);
  });
}
