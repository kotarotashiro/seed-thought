-- AlterTable
ALTER TABLE "LearningCard" ADD COLUMN     "learningMode" TEXT NOT NULL DEFAULT 'content',
ADD COLUMN     "strictLearningJson" TEXT;
