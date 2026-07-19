CREATE TABLE "AutoLearnTask" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoLearnTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AutoLearnTask_postId_key" ON "AutoLearnTask"("postId");

CREATE INDEX "AutoLearnTask_status_createdAt_idx" ON "AutoLearnTask"("status", "createdAt");

ALTER TABLE "AutoLearnTask" ADD CONSTRAINT "AutoLearnTask_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
