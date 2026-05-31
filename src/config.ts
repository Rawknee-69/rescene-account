function splitOrigins(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT || 3001),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
  corsOrigins: splitOrigins(process.env.CORS_ORIGINS),
  anilistTokenEncryptionKey: process.env.ANILIST_TOKEN_ENCRYPTION_KEY || '',
};

export function assertConfig(): void {
  if (!config.databaseUrl) throw new Error('DATABASE_URL is required');
  if (!config.jwtSecret || config.jwtSecret.length < 16) {
    throw new Error('JWT_SECRET must be at least 16 characters');
  }
}
