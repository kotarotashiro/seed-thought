-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourcePostId" TEXT,
    "sourceUrl" TEXT,
    "savedType" TEXT NOT NULL,
    "authorName" TEXT,
    "authorUsername" TEXT,
    "authorAvatarUrl" TEXT,
    "text" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3),
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostClassification" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "postType" TEXT NOT NULL,
    "primaryCategory" TEXT NOT NULL,
    "tagsJson" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "recommendReason" TEXT NOT NULL,
    "difficultyLevel" TEXT NOT NULL,
    "outputPotentialScore" INTEGER NOT NULL DEFAULT 0,
    "learningPotentialScore" INTEGER NOT NULL DEFAULT 0,
    "thinkingPotentialScore" INTEGER NOT NULL DEFAULT 0,
    "recommendedMode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostClassification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeepDiveSession" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "finalSummary" TEXT,
    "userFinalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DeepDiveSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeepDiveStep" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "stepKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "aiContentJson" TEXT NOT NULL,
    "userNote" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeepDiveStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedOutput" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "outputType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedOutput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XAccount" (
    "id" TEXT NOT NULL,
    "xUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopesJson" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XSyncRun" (
    "id" TEXT NOT NULL,
    "xAccountId" TEXT NOT NULL,
    "syncType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "requestedLimit" INTEGER NOT NULL,
    "fetchedCount" INTEGER NOT NULL DEFAULT 0,
    "insertedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedDuplicateCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "XSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Post_sourcePostId_savedType_key" ON "Post"("sourcePostId", "savedType");

-- CreateIndex
CREATE UNIQUE INDEX "PostClassification_postId_key" ON "PostClassification"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "DeepDiveStep_sessionId_stepIndex_key" ON "DeepDiveStep"("sessionId", "stepIndex");

-- CreateIndex
CREATE UNIQUE INDEX "XAccount_xUserId_key" ON "XAccount"("xUserId");

-- AddForeignKey
ALTER TABLE "PostClassification" ADD CONSTRAINT "PostClassification_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeepDiveSession" ADD CONSTRAINT "DeepDiveSession_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeepDiveStep" ADD CONSTRAINT "DeepDiveStep_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DeepDiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedOutput" ADD CONSTRAINT "GeneratedOutput_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DeepDiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XSyncRun" ADD CONSTRAINT "XSyncRun_xAccountId_fkey" FOREIGN KEY ("xAccountId") REFERENCES "XAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
