import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';

export default async function meRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (req) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: {
        accountLinks: { select: { provider: true, providerUserId: true, linkedAt: true } },
      },
    });
    if (!user) {
      return { error: 'User not found' };
    }
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      links: user.accountLinks.map((l) => ({
        provider: l.provider,
        providerUserId: l.providerUserId,
        linkedAt: l.linkedAt,
      })),
      anilistLinked: user.accountLinks.some((l) => l.provider === 'anilist'),
    };
  });
}
