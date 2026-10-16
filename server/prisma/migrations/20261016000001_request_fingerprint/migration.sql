-- Detect reuse of an idempotency key with a different intended payload.
ALTER TABLE "BookCopy" ADD COLUMN "requestHash" TEXT;
