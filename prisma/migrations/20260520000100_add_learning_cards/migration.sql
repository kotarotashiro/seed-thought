CREATE TABLE "LearningCard" (
  "id" TEXT NOT NULL,
  "sourcePostId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "coreInsight" TEXT NOT NULL,
  "manual" TEXT NOT NULL,
  "diagramPrompt" TEXT NOT NULL,
  "imagePrompt" TEXT NOT NULL,
  "outputJson" TEXT NOT NULL,
  "userMemo" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LearningCard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LearningCard_sourcePostId_key" ON "LearningCard"("sourcePostId");

ALTER TABLE "LearningCard"
  ADD CONSTRAINT "LearningCard_sourcePostId_fkey"
  FOREIGN KEY ("sourcePostId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
