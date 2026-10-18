CREATE TYPE "CoverStyle" AS ENUM ('parchment', 'forest', 'burgundy', 'midnight');
ALTER TABLE "BookCopy" ADD COLUMN "coverStyle" "CoverStyle" NOT NULL DEFAULT 'parchment';
