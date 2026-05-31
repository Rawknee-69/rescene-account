import { z } from 'zod';

export function coerceOptionalUrl(v: unknown): string | null {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  if (!s) return null;
  try {
    const normalized = s.startsWith('//') ? `https:${s}` : s;
    new URL(normalized);
    return normalized;
  } catch {
    return null;
  }
}

export function coerceTitle(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : '';
  return s || 'Untitled';
}

export function coercePositiveInt(v: unknown, fallback = 1): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function coerceOptionalPositiveInt(v: unknown): number | null {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function coercePercent(v: unknown): number {
  let n = Number(v);
  if (!Number.isFinite(n)) return 0;
  if (n > 1) n /= 100;
  return Math.min(1, Math.max(0, n));
}

export function coerceOptionalAnilistId(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** MangaDex chapters use decimal strings like "1.1". */
export function coerceOptionalChapterNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function coerceNonNegativeNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function coerceOptionalNonNegativeNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const optionalUrlSchema = z.preprocess(
  coerceOptionalUrl,
  z.string().url().nullable().optional(),
);

export const watchBodySchema = z.object({
  mediaKind: z.enum(['anime', 'hentai']),
  canonicalKey: z.string().min(1).max(200),
  title: z.preprocess(coerceTitle, z.string().min(1).max(500)),
  posterUrl: optionalUrlSchema,
  episodeNumber: z.preprocess((v) => coercePositiveInt(v, 1), z.number().int().positive()),
  episodeLabel: z.string().max(200).optional().nullable(),
  positionSec: z.preprocess((v) => coerceNonNegativeNumber(v, 0), z.number().min(0).default(0)),
  durationSec: z.preprocess(
    coerceOptionalNonNegativeNumber,
    z.number().min(0).nullable().optional(),
  ),
  percent: z.preprocess(coercePercent, z.number().min(0).max(1).default(0)),
  routeJson: z.record(z.string(), z.unknown()).optional().nullable(),
  anilistId: z.preprocess(
    coerceOptionalAnilistId,
    z.number().int().positive().nullable().optional(),
  ),
  completed: z.boolean().optional(),
});

export const readBodySchema = z.object({
  mediaKind: z.enum(['manga', 'novel']),
  canonicalKey: z.string().min(1).max(200),
  title: z.preprocess(coerceTitle, z.string().min(1).max(500)),
  posterUrl: optionalUrlSchema,
  provider: z.string().min(1).max(64),
  mediaId: z.string().min(1).max(200),
  chapterId: z.string().max(200).optional().nullable(),
  chapterNumber: z.preprocess(
    coerceOptionalChapterNumber,
    z.number().nullable().optional(),
  ),
  pageIndex: z.preprocess(
    (v) => Math.max(0, Math.floor(coerceNonNegativeNumber(v, 0))),
    z.number().int().min(0).default(0),
  ),
  totalPages: z.preprocess(
    coerceOptionalPositiveInt,
    z.number().int().positive().nullable().optional(),
  ),
  percent: z.preprocess(coercePercent, z.number().min(0).max(1).default(0)),
  language: z.string().max(16).optional().nullable(),
  routeJson: z.record(z.string(), z.unknown()).optional().nullable(),
  anilistId: z.preprocess(
    coerceOptionalAnilistId,
    z.number().int().positive().nullable().optional(),
  ),
});

export const mergeSchema = z.object({
  watch: z.array(z.unknown()).max(100).optional(),
  read: z.array(z.unknown()).max(100).optional(),
});

export type WatchProgressBody = z.infer<typeof watchBodySchema>;
export type ReadProgressBody = z.infer<typeof readBodySchema>;
