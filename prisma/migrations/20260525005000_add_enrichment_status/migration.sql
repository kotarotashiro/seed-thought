-- Phase 4: enrichmentStatus column for URL content auto-fetch pipeline
-- Idempotent: uses DO block to skip if column already exists

DO $$ BEGIN
  ALTER TABLE "Post" ADD COLUMN "enrichmentStatus" TEXT NOT NULL DEFAULT 'done';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Rollback:
-- ALTER TABLE "Post" DROP COLUMN IF EXISTS "enrichmentStatus";
