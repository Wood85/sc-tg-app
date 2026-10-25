import { buildApp } from './app.ts';
import { bot, startBot } from './bot.ts';
import { client } from './db/index.ts';
import { env } from './env.ts';
import { deleteOrphanPhotos } from './photos/cleanup.ts';

const app = await buildApp();

await app.listen({ port: env.PORT, host: '0.0.0.0' });
const cleanPhotos = () =>
  deleteOrphanPhotos()
    .then((count) => count > 0 && app.log.info(`Deleted ${count} orphan photos`))
    .catch((err) => app.log.error(err, 'Photo cleanup failed'));
void cleanPhotos();
setInterval(cleanPhotos, 6 * 60 * 60 * 1000).unref();

await startBot(app.log).catch((err) => app.log.error(err, 'Bot failed to start'));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    await bot.stop();
    await app.close();
    await client.end();
    process.exit(0);
  });
}
