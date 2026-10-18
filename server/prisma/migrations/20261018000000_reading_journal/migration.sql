-- Private reading journal entries, each tied to an owned copy.
CREATE TYPE "JournalEntryKind" AS ENUM ('note', 'quote');

CREATE TABLE "JournalEntry" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "copyId" UUID NOT NULL,
    "kind" "JournalEntryKind" NOT NULL,
    "body" VARCHAR(5000) NOT NULL,
    "page" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JournalEntry_userId_copyId_createdAt_idx" ON "JournalEntry"("userId", "copyId", "createdAt");
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_copyId_userId_fkey" FOREIGN KEY ("copyId", "userId") REFERENCES "BookCopy"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_page_check" CHECK ("page" IS NULL OR "page" >= 1);
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_body_not_blank_check" CHECK (length(btrim("body")) > 0);
