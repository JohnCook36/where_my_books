-- User-owned durable reading timers and append-only progress history.
CREATE TYPE "ProgressChangeSource" AS ENUM ('manual', 'session');

CREATE TABLE "ReadingSession" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "copyId" UUID NOT NULL,
  "startPage" INTEGER NOT NULL,
  "endPage" INTEGER,
  "durationSeconds" INTEGER,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "ReadingSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReadingSession_id_userId_key" ON "ReadingSession"("id", "userId");
CREATE INDEX "ReadingSession_userId_copyId_startedAt_idx" ON "ReadingSession"("userId", "copyId", "startedAt");
CREATE INDEX "ReadingSession_userId_finishedAt_idx" ON "ReadingSession"("userId", "finishedAt");
-- At most one active timer per account, even for concurrent requests.
CREATE UNIQUE INDEX "ReadingSession_one_active_per_user_idx" ON "ReadingSession"("userId") WHERE "finishedAt" IS NULL;

ALTER TABLE "ReadingSession" ADD CONSTRAINT "ReadingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReadingSession" ADD CONSTRAINT "ReadingSession_copyId_userId_fkey" FOREIGN KEY ("copyId", "userId") REFERENCES "BookCopy"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReadingSession" ADD CONSTRAINT "ReadingSession_page_check" CHECK ("startPage" >= 0 AND ("endPage" IS NULL OR "endPage" >= 0));
ALTER TABLE "ReadingSession" ADD CONSTRAINT "ReadingSession_duration_check" CHECK ("durationSeconds" IS NULL OR "durationSeconds" >= 0);
ALTER TABLE "ReadingSession" ADD CONSTRAINT "ReadingSession_finish_check" CHECK (
 ("finishedAt" IS NULL AND "endPage" IS NULL AND "durationSeconds" IS NULL)
 OR ("finishedAt" IS NOT NULL AND "endPage" IS NOT NULL AND "durationSeconds" IS NOT NULL)
);

CREATE TABLE "ReadingProgressEvent" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "copyId" UUID NOT NULL,
  "fromPage" INTEGER NOT NULL,
  "toPage" INTEGER NOT NULL,
  "source" "ProgressChangeSource" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReadingProgressEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReadingProgressEvent_userId_copyId_createdAt_idx" ON "ReadingProgressEvent"("userId", "copyId", "createdAt");
ALTER TABLE "ReadingProgressEvent" ADD CONSTRAINT "ReadingProgressEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReadingProgressEvent" ADD CONSTRAINT "ReadingProgressEvent_copyId_userId_fkey" FOREIGN KEY ("copyId", "userId") REFERENCES "BookCopy"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReadingProgressEvent" ADD CONSTRAINT "ReadingProgressEvent_pages_check" CHECK ("fromPage" >= 0 AND "toPage" >= 0);
