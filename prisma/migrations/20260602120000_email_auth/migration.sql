-- Migrate from Discord-user schema to email/password (run only if upgrading old DB)
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_discordId_key";
ALTER TABLE "User" DROP COLUMN IF EXISTS "discordId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "discordUsername";
ALTER TABLE "User" DROP COLUMN IF EXISTS "avatarUrl";

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "displayName" TEXT;

-- Fresh DBs created with 20260601120000_init already have these NOT NULL columns.
-- For legacy rows only: delete orphan users or reset DB with db:push on empty database.

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
