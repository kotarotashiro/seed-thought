-- 元の投稿を含めた学習内容全体をMarkdownに整形して保存するための列。
-- エクスポート実行時に生成・上書きされる（資産としてDBに残す）。Idempotent.
ALTER TABLE "LearningCard" ADD COLUMN IF NOT EXISTS "exportText" TEXT;
