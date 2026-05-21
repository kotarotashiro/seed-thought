-- DropForeignKey
ALTER TABLE "GeneratedOutput" DROP CONSTRAINT IF EXISTS "GeneratedOutput_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "DeepDiveStep" DROP CONSTRAINT IF EXISTS "DeepDiveStep_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "DeepDiveSession" DROP CONSTRAINT IF EXISTS "DeepDiveSession_postId_fkey";

-- DropTable
DROP TABLE IF EXISTS "GeneratedOutput";

-- DropTable
DROP TABLE IF EXISTS "DeepDiveStep";

-- DropTable
DROP TABLE IF EXISTS "DeepDiveSession";
