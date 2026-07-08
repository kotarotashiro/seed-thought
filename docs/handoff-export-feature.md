# ハンドオフ: 記事用コピー全範囲化＋学習内容エクスポート（2026-07-09）

実装はほぼ完了済み。**残タスクは E1（マイグレーション適用）のみ**。E2以降は検証とコミット。

## 現在の状態（重要）

- **ローカルアプリは今壊れている**。schema.prisma に `LearningCard.exportText` を追加して
  `prisma generate` 済みだが、DBに列がまだ無い。そのため学習カード一覧・レコメンド等の
  既存クエリが `P2022 ColumnNotFound` で全滅している。E1で直る。
- 本番（Vercel）は無傷。この変更は未コミット・未pushのため。

## 実装済みの内容

1. **記事用にコピーの全範囲化** — `src/lib/export/cardCopyText.ts` の `buildCardCopyText` を拡張。
   第4引数 `originalPostText`（元投稿。ツリー連結済み）を追加し、解読セクション一式
   （なぜすごいか/変化の文脈/仕組み/型/隣接の型/発信ネタの種）・手順・コツ・用途・実行形を網羅。
2. **エクスポートAPI** — `src/app/api/learning-cards/[cardId]/export/route.ts`（POST）。
   全文Markdownを生成 → `LearningCard.exportText` に上書き保存（DB資産化）→
   `{ exportText, filename }` を返す。
3. **UI** — 学習ページに「エクスポート」ボタン（記事用にコピーの隣）。
   API呼び出し→ .md をダウンロード。
4. **スキーマ** — `prisma/schema.prisma` に `exportText String?`、
   マイグレーション `prisma/migrations/20260709000000_add_learning_card_export_text/migration.sql`
   （`ADD COLUMN IF NOT EXISTS` のみ、追記のみで安全）。

tsc・テスト99件は通過済み。

## 残タスク

### E1: マイグレーション適用（最優先・これでアプリが直る）
```
pnpm run db:deploy
```
- **絶対に `prisma migrate dev` を使わない**。このrepoはdrift既知で、
  reset（本番全データ削除）を提案してくる。migrate deploy はdrift検出をしないので安全。
- DBはローカル/本番共用のNeon。deploy後、ローカルは即復旧する。

### E2: 動作確認
1. `/posts/{postId}/learning`（学習カード生成済みのもの）を開き、一覧・カードが正常表示されること
2. 「エクスポート」→ .md がダウンロードされ、冒頭に「## 元の投稿」、解読セクションが含まれること
3. 「記事用にコピー」→ 同じ全文がクリップボードに入ること
4. DBの `LearningCard.exportText` に保存されていること（再エクスポートで上書き）

### E3: コミット＆デプロイ
- 対象: schema.prisma / 新マイグレーション / cardCopyText.ts / export route / learning page
- コミット後 `git push origin main`（Vercelのbuildが migrate-deploy を自動実行するため、
  本番DBにも同じ列が入る。順序問題なし＝列は追記のみでnullable）

## 判断済みの設計（変更しない）

- エクスポート形式は Markdown 1ファイル。DB保存は `exportText` への上書き（履歴は持たない）
- 「記事用にコピー」と「エクスポート」は同じ `buildCardCopyText` を使う（内容の一貫性）
- 元投稿はツリー連結済みテキスト（`buildPostTextWithThread`）で含める
