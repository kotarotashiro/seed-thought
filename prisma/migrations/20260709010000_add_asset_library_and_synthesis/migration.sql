CREATE TABLE IF NOT EXISTS "PatternAsset" (
  "id" TEXT NOT NULL,
  "learningCardId" TEXT,
  "sourceKind" TEXT NOT NULL DEFAULT 'decode',
  "name" TEXT NOT NULL,
  "structure" TEXT NOT NULL,
  "variableSlotsJson" TEXT NOT NULL DEFAULT '[]',
  "transferScope" TEXT NOT NULL,
  "usageNote" TEXT,
  "tagsJson" TEXT NOT NULL DEFAULT '[]',
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PatternAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PatternAsset_learningCardId_key" ON "PatternAsset"("learningCardId");

ALTER TABLE "PatternAsset" DROP CONSTRAINT IF EXISTS "PatternAsset_learningCardId_fkey";
ALTER TABLE "PatternAsset" ADD CONSTRAINT "PatternAsset_learningCardId_fkey"
  FOREIGN KEY ("learningCardId") REFERENCES "LearningCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "SynthesisSuggestion" (
  "id" TEXT NOT NULL,
  "dateKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'proposed',
  "cardAId" TEXT NOT NULL,
  "cardBId" TEXT,
  "patternAssetId" TEXT,
  "title" TEXT NOT NULL,
  "angle" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "takeaway" TEXT NOT NULL,
  "seedHook" TEXT,
  "collectionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SynthesisSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SynthesisSuggestion_dateKey_createdAt_idx"
  ON "SynthesisSuggestion"("dateKey", "createdAt");
