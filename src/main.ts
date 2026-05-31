import 'dotenv/config';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import { assertConfig, config } from './config';
import authPlugin from './plugins/auth';
import authRoutes from './routes/auth';
import progressRoutes from './routes/progress';
import meRoutes from './routes/me';

assertConfig();

const isProd = config.nodeEnv === 'production';

function corsOrigin(
  origin: string | undefined,
  cb: (err: Error | null, allow: boolean) => void,
): void {
  if (!config.corsOrigins.length) {
    cb(null, true);
    return;
  }
  if (!origin) {
    cb(null, true);
    return;
  }
  const norm = origin.replace(/\/$/, '');
  cb(null, config.corsOrigins.some((o) => o.replace(/\/$/, '') === norm));
}

const fastify = Fastify({
  logger: isProd ? true : { transport: { target: 'pino-pretty' } },
});

await fastify.register(fastifyCors, {
  origin: config.corsOrigins.length ? corsOrigin : true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});

await fastify.register(authPlugin);

fastify.get('/health', async () => ({ ok: true, service: 'rescene-account' }));

await fastify.register(authRoutes, { prefix: '/v1/auth' });
await fastify.register(progressRoutes, { prefix: '/v1/progress' });
await fastify.register(meRoutes, { prefix: '/v1/me' });

const port = config.port;
await fastify.listen({ port, host: '0.0.0.0' });
fastify.log.info(`rescene-account listening on :${port}`);
