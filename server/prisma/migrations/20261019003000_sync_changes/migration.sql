-- Transactional per-owner revisions; deletions remain visible as tombstones.
CREATE TABLE "SyncCursor" ("userId" UUID NOT NULL, "revision" BIGINT NOT NULL DEFAULT 0, CONSTRAINT "SyncCursor_pkey" PRIMARY KEY ("userId"));
CREATE TABLE "SyncEvent" ("id" BIGSERIAL NOT NULL, "userId" UUID NOT NULL, "revision" BIGINT NOT NULL, "copyId" UUID NOT NULL, "action" VARCHAR(8) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "SyncEvent_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "SyncEvent_userId_revision_key" ON "SyncEvent"("userId", "revision");
CREATE INDEX "SyncEvent_userId_revision_idx" ON "SyncEvent"("userId", "revision");
ALTER TABLE "SyncCursor" ADD CONSTRAINT "SyncCursor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyncEvent" ADD CONSTRAINT "SyncEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyncEvent" ADD CONSTRAINT "SyncEvent_action_check" CHECK ("action" IN ('upsert', 'delete'));

CREATE FUNCTION wmb_sync_copy_changed() RETURNS trigger AS $$
DECLARE owner_id UUID;
DECLARE book_id UUID;
DECLARE next_revision BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    owner_id := OLD."userId"; book_id := OLD."id";
  ELSE
    owner_id := NEW."userId"; book_id := NEW."id";
  END IF;
  INSERT INTO "SyncCursor" ("userId", "revision") VALUES (owner_id, 1)
    ON CONFLICT ("userId") DO UPDATE SET "revision" = "SyncCursor"."revision" + 1
    RETURNING "revision" INTO next_revision;
  INSERT INTO "SyncEvent" ("userId", "revision", "copyId", "action")
    VALUES (owner_id, next_revision, book_id, CASE WHEN TG_OP = 'DELETE' THEN 'delete' ELSE 'upsert' END);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wmb_sync_copy_insert AFTER INSERT ON "BookCopy" FOR EACH ROW EXECUTE FUNCTION wmb_sync_copy_changed();
CREATE TRIGGER wmb_sync_copy_update AFTER UPDATE ON "BookCopy" FOR EACH ROW EXECUTE FUNCTION wmb_sync_copy_changed();
CREATE TRIGGER wmb_sync_copy_delete AFTER DELETE ON "BookCopy" FOR EACH ROW EXECUTE FUNCTION wmb_sync_copy_changed();
