-- Add optional media and translation fields for X posts.
ALTER TABLE "Post" ADD COLUMN "translatedText" TEXT;
ALTER TABLE "Post" ADD COLUMN "mediaJson" TEXT;

ALTER TABLE "ThreadPost" ADD COLUMN "translatedText" TEXT;
ALTER TABLE "ThreadPost" ADD COLUMN "mediaJson" TEXT;
