import { prisma } from '../lib/prisma';
import { decryptToken } from '../lib/crypto';

const ANILIST_URL = 'https://graphql.anilist.co';

async function getAnilistToken(userId: string): Promise<string | null> {
  const link = await prisma.accountLink.findUnique({
    where: { userId_provider: { userId, provider: 'anilist' } },
  });
  if (!link) return null;
  try {
    return decryptToken(link.accessTokenEnc);
  } catch {
    return null;
  }
}

async function anilistQuery<T>(token: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (!res.ok || json.errors?.length) {
    throw new Error(json.errors?.[0]?.message || `AniList ${res.status}`);
  }
  return json.data as T;
}

export async function pushAnimeProgressIfNeeded(
  userId: string,
  anilistId: number,
  episodeNumber: number,
  percent: number,
): Promise<void> {
  if (percent < 0.5 || !anilistId) return;
  const token = await getAnilistToken(userId);
  if (!token) return;

  const cursorKey = `anime_push:${anilistId}:${episodeNumber}`;
  const existing = await prisma.syncCursor.findUnique({
    where: { userId_provider_cursorKey: { userId, provider: 'anilist', cursorKey } },
  });
  if (existing) return;

  await anilistQuery(
    token,
    `mutation ($id: Int, $progress: Int) {
      SaveMediaListEntry(mediaId: $id, progress: $progress) { id progress }
    }`,
    { id: anilistId, progress: episodeNumber },
  );

  await prisma.syncCursor.upsert({
    where: { userId_provider_cursorKey: { userId, provider: 'anilist', cursorKey } },
    create: { userId, provider: 'anilist', cursorKey, cursorVal: String(episodeNumber) },
    update: { cursorVal: String(episodeNumber) },
  });
}

export async function pushMangaProgressIfNeeded(
  userId: string,
  anilistId: number,
  chapterProgress: number,
  percent: number,
): Promise<void> {
  if (percent < 0.5 || !anilistId) return;
  const token = await getAnilistToken(userId);
  if (!token) return;

  const chapterInt = Math.max(1, Math.floor(chapterProgress));
  const cursorKey = `manga_push:${anilistId}:${chapterInt}`;
  const existing = await prisma.syncCursor.findUnique({
    where: { userId_provider_cursorKey: { userId, provider: 'anilist', cursorKey } },
  });
  if (existing) return;

  await anilistQuery(
    token,
    `mutation ($id: Int, $progress: Int) {
      SaveMediaListEntry(mediaId: $id, progress: $progress) { id progress }
    }`,
    { id: anilistId, progress: chapterInt },
  );

  await prisma.syncCursor.upsert({
    where: { userId_provider_cursorKey: { userId, provider: 'anilist', cursorKey } },
    create: { userId, provider: 'anilist', cursorKey, cursorVal: String(chapterInt) },
    update: { cursorVal: String(chapterInt) },
  });
}

type MediaListCollection = {
  Page: {
    pageInfo: { hasNextPage: boolean; currentPage: number };
    mediaList: {
      mediaId: number;
      progress: number;
      status: string;
      media: {
        id: number;
        type: string;
        title: { userPreferred: string };
        coverImage: { large: string };
        episodes?: number;
        chapters?: number;
      };
    }[];
  };
};

export async function importAnilistLists(userId: string): Promise<{ imported: number }> {
  const token = await getAnilistToken(userId);
  if (!token) throw new Error('AniList not linked');

  let imported = 0;

  const data = await anilistQuery<{
    Viewer: {
      mediaList: {
        mediaId: number;
        progress: number;
        status: string;
        media: MediaListCollection['Page']['mediaList'][0]['media'];
      }[];
    };
  }>(
    token,
    `query {
      Viewer {
        mediaList(status: CURRENT, sort: UPDATED_TIME_DESC) {
          mediaId progress status
          media {
            id type
            title { userPreferred }
            coverImage { large }
            episodes chapters
          }
        }
      }
    }`,
  );

  const chunk = data.Viewer?.mediaList ?? [];
  {
    for (const entry of chunk) {
      const media = entry.media;
      if (!media) continue;
      const title = media.title?.userPreferred || 'Unknown';
      const poster = media.coverImage?.large || null;

      if (media.type === 'ANIME' && entry.progress > 0) {
        const canonicalKey = `anilist:${media.id}`;
        const existing = await prisma.watchProgress.findUnique({
          where: { userId_canonicalKey: { userId, canonicalKey } },
        });
        if (existing && existing.updatedAt > new Date(Date.now() - 60_000)) continue;

        await prisma.watchProgress.upsert({
          where: { userId_canonicalKey: { userId, canonicalKey } },
          create: {
            userId,
            mediaKind: 'anime',
            canonicalKey,
            title,
            posterUrl: poster,
            episodeNumber: entry.progress,
            percent: 0,
            anilistId: media.id,
            routeJson: { anilistId: media.id, kind: 'anime' },
          },
          update: {
            title,
            posterUrl: poster ?? undefined,
            episodeNumber: Math.max(existing?.episodeNumber ?? 0, entry.progress),
            anilistId: media.id,
          },
        });
        imported += 1;
      }

      if (media.type === 'MANGA' && entry.progress > 0) {
        const canonicalKey = `anilist_manga:${media.id}`;
        const existing = await prisma.readProgress.findUnique({
          where: { userId_canonicalKey: { userId, canonicalKey } },
        });
        if (existing && existing.updatedAt > new Date(Date.now() - 60_000)) continue;

        await prisma.readProgress.upsert({
          where: { userId_canonicalKey: { userId, canonicalKey } },
          create: {
            userId,
            mediaKind: 'manga',
            canonicalKey,
            title,
            posterUrl: poster,
            provider: 'anilist',
            mediaId: String(media.id),
            chapterNumber: entry.progress,
            percent: 0,
            anilistId: media.id,
            routeJson: { anilistId: media.id, kind: 'manga' },
          },
          update: {
            title,
            posterUrl: poster ?? undefined,
            chapterNumber: Math.max(existing?.chapterNumber ?? 0, entry.progress),
            anilistId: media.id,
          },
        });
        imported += 1;
      }
    }
  }

  await prisma.syncCursor.upsert({
    where: {
      userId_provider_cursorKey: {
        userId,
        provider: 'anilist',
        cursorKey: 'last_import',
      },
    },
    create: {
      userId,
      provider: 'anilist',
      cursorKey: 'last_import',
      cursorVal: new Date().toISOString(),
    },
    update: { cursorVal: new Date().toISOString() },
  });

  return { imported };
}
