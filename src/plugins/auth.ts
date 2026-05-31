import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fp from 'fastify-plugin';
import { config } from '../config';

export type JwtUser = {
  sub: string;
  email: string;
};

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    userId: string;
    userEmail: string;
  }
}

async function authPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyJwt, {
    secret: config.jwtSecret,
    sign: { expiresIn: config.jwtExpiresIn },
  });

  fastify.decorate(
    'authenticate',
    async function authenticate(req: FastifyRequest, reply: FastifyReply) {
      try {
        await req.jwtVerify();
        const payload = req.user as JwtUser;
        req.userId = payload.sub;
        req.userEmail = payload.email;
      } catch {
        return reply.status(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
      }
    },
  );
}

export default fp(authPlugin);
