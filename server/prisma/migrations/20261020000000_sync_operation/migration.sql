CREATE TABLE "SyncOperation" (
  "userId" UUID NOT NULL,
  "operationId" UUID NOT NULL,
  "requestHash" CHAR(64) NOT NULL,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyncOperation_pkey" PRIMARY KEY ("userId","operationId")
);
CREATE INDEX "SyncOperation_userId_createdAt_idx" ON "SyncOperation"("userId","createdAt");
ALTER TABLE "SyncOperation" ADD CONSTRAINT "SyncOperation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
