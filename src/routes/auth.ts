import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { hashPassword, verifyPassword } from '../lib/password';
import { encryptToken } from '../lib/crypto';
import { importAnilistLists } from '../services/anilistSync';

const emailSchema = z.string().email().max(320).transform((s) => s.trim().toLowerCase());

const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(64).optional(),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

const anilistLinkSchema = z.object({
  accessToken: z.string().min(10),
  providerUserId: z.number().int().optional(),
});

function userPayload(user: { id: string; email: string; displayName: string | null }) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
  };
}

function signToken(
  fastify: FastifyInstance,
  user: { id: string; email: string },
): string {
  return fastify.jwt.sign({ sub: user.id, email: user.email });
}

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/register', async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() });
    }

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return reply.status(409).send({ error: 'Email already registered', code: 'EMAIL_EXISTS' });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        passwordHash,
        displayName: parsed.data.displayName?.trim() || null,
      },
    });

    const accessToken = signToken(fastify, user);
    return { accessToken, user: userPayload(user) };
  });

  fastify.post('/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() });
    }

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user) {
      return reply.status(401).send({ error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' });
    }

    const ok = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!ok) {
      return reply.status(401).send({ error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' });
    }

    const accessToken = signToken(fastify, user);
    return { accessToken, user: userPayload(user) };
  });

  fastify.post(
    '/anilist/link',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const parsed = anilistLinkSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() });
      }

      const enc = encryptToken(parsed.data.accessToken);
      await prisma.accountLink.upsert({
        where: { userId_provider: { userId: req.userId, provider: 'anilist' } },
        create: {
          userId: req.userId,
          provider: 'anilist',
          providerUserId: parsed.data.providerUserId ? String(parsed.data.providerUserId) : null,
          accessTokenEnc: enc,
        },
        update: {
          accessTokenEnc: enc,
          providerUserId: parsed.data.providerUserId ? String(parsed.data.providerUserId) : undefined,
        },
      });

      try {
        const { imported } = await importAnilistLists(req.userId);
        return { linked: true, imported };
      } catch (e) {
        req.log.warn(e, 'AniList import after link failed');
        return { linked: true, imported: 0 };
      }
    },
  );

  fastify.delete(
    '/anilist/link',
    { preHandler: [fastify.authenticate] },
    async (req) => {
      await prisma.accountLink.deleteMany({
        where: { userId: req.userId, provider: 'anilist' },
      });
      return { linked: false };
    },
  );
}
