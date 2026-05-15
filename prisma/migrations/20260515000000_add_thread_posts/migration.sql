-- CreateTable
CREATE TABLE "ThreadPost" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "sourcePostId" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "authorName" TEXT,
    "authorUsername" TEXT,
    "authorAvatarUrl" TEXT,
    "text" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3),
    "threadOrder" INTEGER NOT NULL,
    "rawJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThreadPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ThreadPost_postId_sourcePostId_key" ON "ThreadPost"("postId", "sourcePostId");

-- CreateIndex
CREATE INDEX "ThreadPost_postId_threadOrder_idx" ON "ThreadPost"("postId", "threadOrder");

-- AddForeignKey
ALTER TABLE "ThreadPost" ADD CONSTRAINT "ThreadPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
