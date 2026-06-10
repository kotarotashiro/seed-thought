-- Track when a post's thread was last fetched from X (recorded even when no
-- child tweets were found), so we can serve from cache and avoid repeat X API
-- reads on every post open. Idempotent.
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "threadFetchedAt" TIMESTAMP(3);
