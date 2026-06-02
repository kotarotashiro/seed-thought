-- CreateTable
CREATE TABLE "ResearchSession" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'quick',
    "status" TEXT NOT NULL DEFAULT 'done',
    "answer" TEXT NOT NULL,
    "sourcesJson" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResearchSession_source_createdAt_idx" ON "ResearchSession"("source", "createdAt");
