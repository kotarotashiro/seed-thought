-- Add satoriTypeUsed column to LearningCardOutput (idempotent)
ALTER TABLE "LearningCardOutput" ADD COLUMN IF NOT EXISTS "satoriTypeUsed" TEXT;
