-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT,
    "accessTokenEnc" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mediaKind" TEXT NOT NULL,
    "canonicalKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "posterUrl" TEXT,
    "episodeNumber" INTEGER NOT NULL DEFAULT 1,
    "episodeLabel" TEXT,
    "positionSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "durationSec" DOUBLE PRECISION,
    "percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "routeJson" JSONB,
    "anilistId" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatchProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mediaKind" TEXT NOT NULL,
    "canonicalKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "posterUrl" TEXT,
    "provider" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "chapterId" TEXT,
    "chapterNumber" DOUBLE PRECISION,
    "pageIndex" INTEGER NOT NULL DEFAULT 0,
    "totalPages" INTEGER,
    "percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "language" TEXT,
    "routeJson" JSONB,
    "anilistId" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncCursor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "cursorKey" TEXT NOT NULL,
    "cursorVal" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncCursor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AccountLink_userId_idx" ON "AccountLink"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountLink_userId_provider_key" ON "AccountLink"("userId", "provider");

-- CreateIndex
CREATE INDEX "WatchProgress_userId_updatedAt_idx" ON "WatchProgress"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "WatchProgress_userId_mediaKind_updatedAt_idx" ON "WatchProgress"("userId", "mediaKind", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "WatchProgress_userId_canonicalKey_key" ON "WatchProgress"("userId", "canonicalKey");

-- CreateIndex
CREATE INDEX "ReadProgress_userId_updatedAt_idx" ON "ReadProgress"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "ReadProgress_userId_mediaKind_updatedAt_idx" ON "ReadProgress"("userId", "mediaKind", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ReadProgress_userId_canonicalKey_key" ON "ReadProgress"("userId", "canonicalKey");

-- CreateIndex
CREATE INDEX "SyncCursor_userId_provider_idx" ON "SyncCursor"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "SyncCursor_userId_provider_cursorKey_key" ON "SyncCursor"("userId", "provider", "cursorKey");

-- AddForeignKey
ALTER TABLE "AccountLink" ADD CONSTRAINT "AccountLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchProgress" ADD CONSTRAINT "WatchProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadProgress" ADD CONSTRAINT "ReadProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncCursor" ADD CONSTRAINT "SyncCursor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
