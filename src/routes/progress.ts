import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import {
  mergeSchema,
  readBodySchema,
  watchBodySchema,
  type ReadProgressBody,
  type WatchProgressBody,
} from '../lib/progressSanitize';
import {
  importAnilistLists,
  pushAnimeProgressIfNeeded,
  pushMangaProgressIfNeeded,
} from '../services/anilistSync';
import type { Prisma } from '@prisma/client';

function encodeKey(key: string): string {
  return encodeURIComponent(key);
}

export default async function progressRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/watch',
    { preHandler: [fastify.authenticate] },
    async (req) => {
      const kind =
        typeof req.query === 'object' && req.query && 'kind' in req.query
          ? String(req.query.kind)
          : undefined;
      const rows = await prisma.watchProgress.findMany({
        where: {
          userId: req.userId,
          ...(kind && kind !== 'all' ? { mediaKind: kind } : {}),
          completed: false,
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      });
      return { items: rows };
    },
  );

  fastify.get(
    '/read',
    { preHandler: [fastify.authenticate] },
    async (req) => {
      const kind =
        typeof req.query === 'object' && req.query && 'kind' in req.query
          ? String(req.query.kind)
          : undefined;
      const rows = await prisma.readProgress.findMany({
        where: {
          userId: req.userId,
          ...(kind && kind !== 'all' ? { mediaKind: kind } : {}),
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      });
      return { items: rows };
    },
  );

  fastify.put(
    '/watch/:canonicalKey',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const key = decodeURIComponent((req.params as { canonicalKey: string }).canonicalKey);
      const parsed = watchBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() });
      }
      const body = parsed.data;
      if (body.canonicalKey !== key) {
        return reply.status(400).send({ error: 'canonicalKey mismatch' });
      }

      const row = await prisma.watchProgress.upsert({
        where: { userId_canonicalKey: { userId: req.userId, canonicalKey: key } },
        create: {
          userId: req.userId,
          mediaKind: body.mediaKind,
          canonicalKey: key,
          title: body.title,
          posterUrl: body.posterUrl ?? null,
          episodeNumber: body.episodeNumber,
          episodeLabel: body.episodeLabel ?? null,
          positionSec: body.positionSec,
          durationSec: body.durationSec ?? null,
          percent: body.percent,
          routeJson: (body.routeJson ?? undefined) as Prisma.InputJsonValue | undefined,
          anilistId: body.anilistId ?? null,
          completed: body.completed ?? false,
        },
        update: {
          title: body.title,
          posterUrl: body.posterUrl ?? undefined,
          episodeNumber: body.episodeNumber,
          episodeLabel: body.episodeLabel ?? undefined,
          positionSec: body.positionSec,
          durationSec: body.durationSec ?? undefined,
          percent: body.percent,
          routeJson: (body.routeJson ?? undefined) as Prisma.InputJsonValue | undefined,
          anilistId: body.anilistId ?? undefined,
          completed: body.completed ?? false,
        },
      });

      if (body.anilistId && body.mediaKind === 'anime') {
        void pushAnimeProgressIfNeeded(req.userId, body.anilistId, body.episodeNumber, body.percent).catch(
          (e) => req.log.warn(e),
        );
      }

      return { item: row };
    },
  );

  fastify.put(
    '/read/:canonicalKey',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const key = decodeURIComponent((req.params as { canonicalKey: string }).canonicalKey);
      const parsed = readBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() });
      }
      const body = parsed.data;
      if (body.canonicalKey !== key) {
        return reply.status(400).send({ error: 'canonicalKey mismatch' });
      }

      const row = await prisma.readProgress.upsert({
        where: { userId_canonicalKey: { userId: req.userId, canonicalKey: key } },
        create: {
          userId: req.userId,
          mediaKind: body.mediaKind,
          canonicalKey: key,
          title: body.title,
          posterUrl: body.posterUrl ?? null,
          provider: body.provider,
          mediaId: body.mediaId,
          chapterId: body.chapterId ?? null,
          chapterNumber: body.chapterNumber ?? null,
          pageIndex: body.pageIndex,
          totalPages: body.totalPages ?? null,
          percent: body.percent,
          language: body.language ?? null,
          routeJson: (body.routeJson ?? undefined) as Prisma.InputJsonValue | undefined,
          anilistId: body.anilistId ?? null,
        },
        update: {
          title: body.title,
          posterUrl: body.posterUrl ?? undefined,
          chapterId: body.chapterId ?? undefined,
          chapterNumber: body.chapterNumber ?? undefined,
          pageIndex: body.pageIndex,
          totalPages: body.totalPages ?? undefined,
          percent: body.percent,
          language: body.language ?? undefined,
          routeJson: (body.routeJson ?? undefined) as Prisma.InputJsonValue | undefined,
          anilistId: body.anilistId ?? undefined,
        },
      });

      if (body.anilistId && body.mediaKind === 'manga') {
        const ch = body.chapterNumber ?? body.pageIndex;
        void pushMangaProgressIfNeeded(req.userId, body.anilistId, ch, body.percent).catch((e) =>
          req.log.warn(e),
        );
      }

      return { item: row };
    },
  );

  fastify.post(
    '/merge',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const parsed = mergeSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() });
      }

      const watchRows: WatchProgressBody[] = [];
      for (const raw of parsed.data.watch ?? []) {
        const row = watchBodySchema.safeParse(raw);
        if (row.success) {
          watchRows.push(row.data);
          continue;
        }
        req.log.warn(
          { details: row.error.flatten(), canonicalKey: (raw as { canonicalKey?: string })?.canonicalKey },
          'skip invalid watch merge row',
        );
      }

      const readRows: ReadProgressBody[] = [];
      for (const raw of parsed.data.read ?? []) {
        const row = readBodySchema.safeParse(raw);
        if (row.success) {
          readRows.push(row.data);
          continue;
        }
        req.log.warn(
          { details: row.error.flatten(), canonicalKey: (raw as { canonicalKey?: string })?.canonicalKey },
          'skip invalid read merge row',
        );
      }

      let watchMerged = 0;
      let readMerged = 0;

      for (const w of watchRows) {
        const existing = await prisma.watchProgress.findUnique({
          where: { userId_canonicalKey: { userId: req.userId, canonicalKey: w.canonicalKey } },
        });
        const incomingNewer =
          !existing ||
          w.percent > existing.percent ||
          (w.percent === existing.percent && w.positionSec > existing.positionSec);
        if (!incomingNewer) continue;

        await prisma.watchProgress.upsert({
          where: { userId_canonicalKey: { userId: req.userId, canonicalKey: w.canonicalKey } },
          create: {
            userId: req.userId,
            mediaKind: w.mediaKind,
            canonicalKey: w.canonicalKey,
            title: w.title,
            posterUrl: w.posterUrl ?? null,
            episodeNumber: w.episodeNumber,
            episodeLabel: w.episodeLabel ?? null,
            positionSec: w.positionSec,
            durationSec: w.durationSec ?? null,
            percent: w.percent,
            routeJson: (w.routeJson ?? undefined) as Prisma.InputJsonValue | undefined,
            anilistId: w.anilistId ?? null,
            completed: w.completed ?? false,
          },
          update: {
            title: w.title,
            posterUrl: w.posterUrl ?? undefined,
            episodeNumber: w.episodeNumber,
            positionSec: w.positionSec,
            durationSec: w.durationSec ?? undefined,
            percent: w.percent,
            routeJson: (w.routeJson ?? undefined) as Prisma.InputJsonValue | undefined,
            anilistId: w.anilistId ?? undefined,
            completed: w.completed ?? false,
          },
        });
        watchMerged += 1;
      }

      for (const r of readRows) {
        const existing = await prisma.readProgress.findUnique({
          where: { userId_canonicalKey: { userId: req.userId, canonicalKey: r.canonicalKey } },
        });
        const incomingNewer = !existing || r.percent > existing.percent || r.pageIndex > existing.pageIndex;
        if (!incomingNewer) continue;

        await prisma.readProgress.upsert({
          where: { userId_canonicalKey: { userId: req.userId, canonicalKey: r.canonicalKey } },
          create: {
            userId: req.userId,
            mediaKind: r.mediaKind,
            canonicalKey: r.canonicalKey,
            title: r.title,
            posterUrl: r.posterUrl ?? null,
            provider: r.provider,
            mediaId: r.mediaId,
            chapterId: r.chapterId ?? null,
            chapterNumber: r.chapterNumber ?? null,
            pageIndex: r.pageIndex,
            totalPages: r.totalPages ?? null,
            percent: r.percent,
            language: r.language ?? null,
            routeJson: (r.routeJson ?? undefined) as Prisma.InputJsonValue | undefined,
            anilistId: r.anilistId ?? null,
          },
          update: {
            title: r.title,
            percent: r.percent,
            pageIndex: r.pageIndex,
            chapterId: r.chapterId ?? undefined,
            chapterNumber: r.chapterNumber ?? undefined,
            routeJson: (r.routeJson ?? undefined) as Prisma.InputJsonValue | undefined,
          },
        });
        readMerged += 1;
      }

      return { watchMerged, readMerged };
    },
  );

  fastify.post(
    '/sync/anilist/import',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      try {
        const result = await importAnilistLists(req.userId);
        return result;
      } catch (e) {
        return reply.status(400).send({
          error: e instanceof Error ? e.message : 'Import failed',
          code: 'ANILIST_IMPORT_FAILED',
        });
      }
    },
  );

  /** Helper for clients building PUT paths */
  fastify.get('/encode-key', async (req) => {
    const key =
      typeof req.query === 'object' && req.query && 'key' in req.query ? String(req.query.key) : '';
    return { encoded: encodeKey(key) };
  });
}
