-- Migration: add_post_source_and_xauth
-- Rollback: UPDATE "Post" SET "source" = CASE WHEN "savedType" = 'like' THEN 'x' WHEN "savedType" = 'bookmark' THEN 'x' ELSE 'manual' END;
--           ALTER TABLE "Post" ALTER COLUMN "source" DROP DEFAULT;
--           DROP TABLE IF EXISTS "XAuth";

-- Backfill Post.source from existing savedType values (idempotent)
UPDATE "Post" SET "source" = CASE
  WHEN "savedType" = 'like'     THEN 'user_like'
  WHEN "savedType" = 'bookmark' THEN 'user_bookmark'
  ELSE 'user_manual'
END;

-- Add default for future inserts (idempotent in PostgreSQL)
ALTER TABLE "Post" ALTER COLUMN "source" SET DEFAULT 'user_like';

-- CreateTable XAuth (xAI OAuth tokens, single-row design) — idempotent
CREATE TABLE IF NOT EXISTS "XAuth" (
    "id"           TEXT NOT NULL,
    "accessToken"  TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt"    TIMESTAMP(3),
    "scope"        TEXT NOT NULL DEFAULT '',
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "XAuth_pkey" PRIMARY KEY ("id")
);
