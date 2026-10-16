-- Additive staging fields; existing ISBN-only queues remain valid unreviewed drafts.
ALTER TABLE "ScanDraft"
  ADD COLUMN "payload" JSONB,
  ADD COLUMN "reviewed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
