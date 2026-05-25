-- Phase 6: XDraft table for X post draft approval pipeline
CREATE TABLE "XDraft" (
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

-- Index for efficient status filtering
CREATE INDEX "XDraft_learningCardId_idx" ON "XDraft"("learningCardId");
CREATE INDEX "XDraft_status_idx" ON "XDraft"("status");

-- Foreign key to LearningCard (SET NULL on delete)
ALTER TABLE "XDraft"
    ADD CONSTRAINT "XDraft_learningCardId_fkey"
    FOREIGN KEY ("learningCardId")
    REFERENCES "LearningCard"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Rollback:
-- DROP TABLE IF EXISTS "XDraft";
