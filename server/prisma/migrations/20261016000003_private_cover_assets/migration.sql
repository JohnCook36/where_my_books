CREATE TYPE "CoverMode" AS ENUM ('automatic', 'catalog', 'custom', 'placeholder');
CREATE TYPE "UserCoverSource" AS ENUM ('gallery', 'camera');
CREATE TABLE "CoverAsset" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "source" "UserCoverSource" NOT NULL,
  "checksum" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "bytes" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoverAsset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CoverAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CoverAsset_safe_dimensions" CHECK ("width" > 0 AND "height" > 0 AND "width" <= 1200 AND "height" <= 1800),
  CONSTRAINT "CoverAsset_safe_bytes" CHECK ("byteSize" > 0 AND "byteSize" <= 2000000 AND octet_length("bytes") = "byteSize"),
  CONSTRAINT "CoverAsset_jpeg" CHECK ("mimeType" = 'image/jpeg')
);
CREATE UNIQUE INDEX "CoverAsset_userId_checksum_key" ON "CoverAsset"("userId", "checksum");
ALTER TABLE "BookCopy" ADD COLUMN "coverMode" "CoverMode" NOT NULL DEFAULT 'automatic', ADD COLUMN "coverAssetId" UUID;
-- Preserve all legacy per-copy choices and all existing edition metadata.
UPDATE "BookCopy" SET "coverMode" = 'catalog' WHERE "coverUri" IS NOT NULL;
CREATE INDEX "BookCopy_coverAssetId_idx" ON "BookCopy"("coverAssetId");
ALTER TABLE "BookCopy" ADD CONSTRAINT "BookCopy_coverAssetId_fkey" FOREIGN KEY ("coverAssetId") REFERENCES "CoverAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
