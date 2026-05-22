-- SRS fields on LearningCard
ALTER TABLE "LearningCard" ADD COLUMN "reviewLevel" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LearningCard" ADD COLUMN "lastReviewedAt" TIMESTAMP(3);
ALTER TABLE "LearningCard" ADD COLUMN "nextDueAt" TIMESTAMP(3);

-- Generated images for learning cards
CREATE TABLE "LearningCardImage" (
    "id" TEXT NOT NULL,
    "learningCardId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/png',
    "dataBase64" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LearningCardImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LearningCardImage_learningCardId_idx" ON "LearningCardImage"("learningCardId");

ALTER TABLE "LearningCardImage"
    ADD CONSTRAINT "LearningCardImage_learningCardId_fkey"
    FOREIGN KEY ("learningCardId") REFERENCES "LearningCard"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Collections
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "outputJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CollectionItem" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "learningCardId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CollectionItem_collectionId_learningCardId_key" ON "CollectionItem"("collectionId", "learningCardId");
CREATE INDEX "CollectionItem_collectionId_order_idx" ON "CollectionItem"("collectionId", "order");

ALTER TABLE "CollectionItem"
    ADD CONSTRAINT "CollectionItem_collectionId_fkey"
    FOREIGN KEY ("collectionId") REFERENCES "Collection"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CollectionItem"
    ADD CONSTRAINT "CollectionItem_learningCardId_fkey"
    FOREIGN KEY ("learningCardId") REFERENCES "LearningCard"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
