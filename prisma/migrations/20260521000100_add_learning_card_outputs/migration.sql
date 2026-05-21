-- CreateTable
CREATE TABLE "LearningCardOutput" (
    "id" TEXT NOT NULL,
    "learningCardId" TEXT NOT NULL,
    "outputType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningCardOutput_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearningCardOutput_learningCardId_idx" ON "LearningCardOutput"("learningCardId");

-- AddForeignKey
ALTER TABLE "LearningCardOutput" ADD CONSTRAINT "LearningCardOutput_learningCardId_fkey" FOREIGN KEY ("learningCardId") REFERENCES "LearningCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
