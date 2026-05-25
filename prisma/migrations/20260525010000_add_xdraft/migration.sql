-- Phase 6: XDraft table for X post draft approval pipeline — idempotent
CREATE TABLE IF NOT EXISTS "XDraft" (
    "id"             TEXT NOT NULL,
    "learningCardId" TEXT,
    "content"        TEXT NOT NULL,
    "status"         TEXT NOT NULL DEFAULT 'pending',
    "postedUrl"      TEXT,
    "postedAt"       TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XDraft_pkey" PRIMARY KEY ("id")
);

-- Indexes (IF NOT EXISTS requires PG 9.5+, Neon supports it)
CREATE INDEX IF NOT EXISTS "XDraft_learningCardId_idx" ON "XDraft"("learningCardId");
CREATE INDEX IF NOT EXISTS "XDraft_status_idx" ON "XDraft"("status");

-- Foreign key (skip if already exists)
DO $$ BEGIN
  ALTER TABLE "XDraft"
    ADD CONSTRAINT "XDraft_learningCardId_fkey"
    FOREIGN KEY ("learningCardId")
    REFERENCES "LearningCard"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Rollback:
-- DROP TABLE IF EXISTS "XDraft";
