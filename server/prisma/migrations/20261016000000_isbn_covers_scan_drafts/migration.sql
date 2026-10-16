-- Additive: all existing records, IDs and migrations are preserved.
ALTER TABLE "Edition" ADD COLUMN "catalogSource" TEXT, ADD COLUMN "externalId" TEXT;
ALTER TABLE "BookCopy" ADD COLUMN "clientRequestId" UUID, ADD COLUMN "coverUri" TEXT;
CREATE UNIQUE INDEX "BookCopy_userId_clientRequestId_key" ON "BookCopy"("userId", "clientRequestId");
CREATE TABLE "ScanDraft" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "isbn" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScanDraft_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ScanDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ScanDraft_userId_isbn_key" ON "ScanDraft"("userId", "isbn");
CREATE INDEX "Edition_isbn_idx" ON "Edition"("isbn");
