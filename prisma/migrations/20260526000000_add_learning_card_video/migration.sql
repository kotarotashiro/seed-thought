-- CreateTable
CREATE TABLE IF NOT EXISTS "LearningCardVideo" (
    "id" TEXT NOT NULL,
    "learningCardId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "videoId" TEXT,
    "videoUrl" TEXT,
    "thumbnailUrl" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningCardVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LearningCardVideo_learningCardId_idx" ON "LearningCardVideo"("learningCardId");

-- AddForeignKey
ALTER TABLE "LearningCardVideo" DROP CONSTRAINT IF EXISTS "LearningCardVideo_learningCardId_fkey";
ALTER TABLE "LearningCardVideo" ADD CONSTRAINT "LearningCardVideo_learningCardId_fkey" FOREIGN KEY ("learningCardId") REFERENCES "LearningCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
