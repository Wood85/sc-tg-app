import Fastify from 'fastify';
import { bot, startBot } from './bot.ts';
import { client } from './db/index.ts';
import { env } from './env.ts';
import { meRoutes } from './routes/me.ts';

const app = Fastify({ logger: true });
app.decorateRequest('user');

app.get('/health', async () => ({ ok: true }));
await app.register(meRoutes, { prefix: '/api' });

await app.listen({ port: env.PORT, host: '0.0.0.0' });
await startBot(app.log).catch((err) => app.log.error(err, 'Bot failed to start'));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    await bot.stop();
    await app.close();
    await client.end();
    process.exit(0);
  });
}
