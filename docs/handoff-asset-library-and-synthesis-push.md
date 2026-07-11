# ハンドオフ: 資産庫スキーマ + 掛け合わせpush最小版（2026-07-09）

SeedThought 2 ロードマップ（`docs/seedthought2-concept.md`）のステップ2と、ステップ4の最小版を実装する。
**この文書だけで実装が完結するように書いてある。ここに書かれた設計判断は変更しない。**
迷ったらこの文書 → `docs/seedthought2-concept.md` → 実コードの順に参照する。

---

## 0. ゴールと非ゴール

### ゴール（完成の定義）

1. **資産庫**: 解読器が抽出した「型」（`decode.extractedPattern`）が独立テーブル `PatternAsset` に
   第一級レコードとして蓄積され、`/assets` ページで一覧できる。過去カード分もバックフィルされている。
2. **掛け合わせpush**: ホーム（`/`）を開くと「今日の掛け合わせ」が1件表示される。
   解読済み素材2つ（または素材×型）から生成された発信ネタの種で、
   「採用」すると既存の Collection 機能に流れて発信生成につながる。
3. LLMコストは **1日1回の生成 + 再生成最大2回**（計3回/日）を上限とし、cronは使わない。

### 非ゴール（やらない。提案もしない）

- 過去カードの**再解読**（decode が無い旧カードへの解読実行）— ステップ3の範囲
- 示唆（insight）のエンティティ化 — 型のみ。示唆は将来
- 知識マップ（/map）の資産庫ビュー化 — 将来
- 掛け合わせ pull UI（素材を自分で選んで指示）— 既存 Collection がその役割を果たすため不要
- Web検索を伴う深掘り — 課金API回避の原則
- cron / スケジュール実行 — x-sync cron停止の経緯があり、オンデマンド＋日次キャッシュ一択

---

## 1. 実装前に必ず読むもの

| 対象 | 理由 |
|---|---|
| `node_modules/next/dist/docs/` の関連ガイド | この repo の Next.js は学習データと異なる（AGENTS.md 参照）。route handler / page を書く前に必読 |
| `src/lib/ai/types.ts` の `DecodeOutput`（78行付近） | 昇格元データの正確な形 |
| `src/lib/ai/provider.ts` の `generateDecodeWithReview`（191行付近）と `getAiProvider`（384行付近） | AI呼び出しの既存パターン。新メソッドはこれに倣う |
| `src/lib/ai/settings.ts` の `AiFeature`（27行付近） | 機能別モデル設定のレジストリ。新機能キーの登録先 |
| `src/app/api/posts/[postId]/learning/route.ts` | カード生成の永続化箇所。昇格フックを入れる場所 |
| `src/app/api/learning-cards/[cardId]/route.ts` | 既存 route handler の書き方（レスポンス形式・エラー処理）の手本 |
| `src/app/page.tsx` | ホーム。「今日の掛け合わせ」セクションの挿入先 |
| `prisma/schema.prisma` | JSON類は `String` カラムに文字列で持つ流儀（`tagsJson` 等）。踏襲する |

---

## 2. 絶対禁止事項（repo固有の地雷）

1. **`prisma migrate dev` を絶対に使わない**（`pnpm run db:migrate` も同じなので使わない）。
   この repo は drift 既知で、reset（本番DB全削除）を提案してくる。
   **手動でマイグレーションSQLを書き → `pnpm run db:deploy`** の一択。
2. **作業順序**: ①schema.prisma 編集＋migration.sql 作成 → ②`pnpm run db:deploy` → ③`pnpm run db:generate`。
   ②より先に③をやると、生成済みクライアントとDBがずれて既存画面が P2022 で全滅する。
3. DBはローカル/本番共用の Neon。マイグレーションSQLは**追記のみ**（CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS）。DROP・型変更・NOT NULL化は書かない。
4. `next build` は ESLint を走らせない。デプロイ可否は `pnpm typecheck`（tsc）で判断する。
   既存の ESLint エラー（set-state-in-effect 約8件）は触らない。
5. 開発サーバーの二重起動禁止。ユーザーの `:3000` が `.next` のロックを持っていることがある。
   検証は「tsc + vitest + ユーザーが開いている dev サーバーの HMR」で行う。

---

## 3. Phase A: 資産庫スキーマ

### A-1. Prisma スキーマ（このまま追加）

`prisma/schema.prisma` に以下を追加し、`LearningCard` に逆リレーション `patternAsset PatternAsset?` を1行追加する。

```prisma
// 資産庫: 解読器が抽出した「再利用可能な型」の第一級レコード（SeedThought 2 ステップ2）
// 出所カードが消えても資産は残す（onDelete: SetNull）
model PatternAsset {
  id                String   @id @default(cuid())
  learningCardId    String?  @unique
  sourceKind        String   @default("decode") // "decode"（将来 "manual" 等を追加）
  name              String
  structure         String
  variableSlotsJson String   @default("[]") // JSON array of strings
  transferScope     String
  usageNote         String?
  tagsJson          String   @default("[]") // decode.synthesisTags のコピー。掛け合わせ突合に使う
  status            String   @default("active") // "active" | "archived"
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  learningCard LearningCard? @relation(fields: [learningCardId], references: [id], onDelete: SetNull)
}

// 掛け合わせ提案の記録（= 資産庫の「掛け合わせの当たり」の記録を兼ねる）
model SynthesisSuggestion {
  id             String   @id @default(cuid())
  dateKey        String   // JST の "YYYY-MM-DD"
  status         String   @default("proposed") // "proposed" | "accepted" | "dismissed"
  cardAId        String   // LearningCard.id（FK は張らない。カード削除後も記録として残す）
  cardBId        String?  // 素材×素材のとき。素材×型のときは null
  patternAssetId String?  // 素材×型のとき。素材×素材のときは null
  title          String
  angle          String
  reason         String
  takeaway       String
  seedHook       String?
  collectionId   String?  // accept 時に作成した Collection.id
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([dateKey, createdAt])
}
```

### A-2. マイグレーションSQL

`prisma/migrations/20260709010000_add_asset_library_and_synthesis/migration.sql` を新規作成（このまま）:

```sql
CREATE TABLE IF NOT EXISTS "PatternAsset" (
  "id" TEXT NOT NULL,
  "learningCardId" TEXT,
  "sourceKind" TEXT NOT NULL DEFAULT 'decode',
  "name" TEXT NOT NULL,
  "structure" TEXT NOT NULL,
  "variableSlotsJson" TEXT NOT NULL DEFAULT '[]',
  "transferScope" TEXT NOT NULL,
  "usageNote" TEXT,
  "tagsJson" TEXT NOT NULL DEFAULT '[]',
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PatternAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PatternAsset_learningCardId_key" ON "PatternAsset"("learningCardId");

ALTER TABLE "PatternAsset" DROP CONSTRAINT IF EXISTS "PatternAsset_learningCardId_fkey";
ALTER TABLE "PatternAsset" ADD CONSTRAINT "PatternAsset_learningCardId_fkey"
  FOREIGN KEY ("learningCardId") REFERENCES "LearningCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "SynthesisSuggestion" (
  "id" TEXT NOT NULL,
  "dateKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'proposed',
  "cardAId" TEXT NOT NULL,
  "cardBId" TEXT,
  "patternAssetId" TEXT,
  "title" TEXT NOT NULL,
  "angle" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "takeaway" TEXT NOT NULL,
  "seedHook" TEXT,
  "collectionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SynthesisSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SynthesisSuggestion_dateKey_createdAt_idx"
  ON "SynthesisSuggestion"("dateKey", "createdAt");
```

適用: `pnpm run db:deploy` → `pnpm run db:generate`（この順）。

### A-3. 昇格ロジック（共通関数）

`src/lib/assets/promotePattern.ts` を新規作成:

```
promotePatternAsset(learningCardId: string, decode: DecodeOutput | null | undefined): Promise<void>
```

仕様（決定的に）:
- `decode?.extractedPattern` が **null/undefined なら何もしない**（既存資産があっても消さない。資産は耐久財）。
- ある場合は `prisma.patternAsset.upsert`（where: `learningCardId`）で
  name / structure / variableSlotsJson(JSON.stringify) / transferScope / usageNote /
  tagsJson(= `decode.synthesisTags` を JSON.stringify) を作成 or 上書き。`status` は上書きしない（archived を尊重）。
- 失敗しても throw せず `console.warn` で握りつぶす（カード生成を巻き込まない。decode と同じ best-effort 思想）。

呼び出し箇所: `src/app/api/posts/[postId]/learning/route.ts` で学習カードを DB に永続化した**直後**に
`await promotePatternAsset(card.id, output.decode)` を1行追加。再生成時も同じ経路を通るので upsert で自動更新される。

### A-4. バックフィルスクリプト

`scripts/backfill-pattern-assets.ts` を新規作成。実行: `pnpm exec tsx scripts/backfill-pattern-assets.ts`

- 全 `LearningCard` を取得 → `outputJson` を `JSON.parse`（try/catch、壊れていたら skip して件数だけ数える）
- `parsed.decode?.extractedPattern` があるものだけ A-3 の `promotePatternAsset` を呼ぶ
- 最後に `対象カード数 / 昇格した件数 / skip数` を stdout に出す
- **冪等**（upsert なので2回実行しても件数が増えない）こと

### A-5. 資産庫 API と UI

**API** `src/app/api/assets/route.ts`:
- `GET` → `{ assets: [...] }`。`PatternAsset` を `createdAt desc` で全件。
  各要素: `{ id, name, structure, variableSlots: string[], transferScope, usageNote, tags: string[], status, createdAt, sourceCard: { learningCardId, title, sourcePostId } | null }`
  （JSONカラムはパースして返す。`sourceCard` は relation include で `LearningCard.title` と `sourcePostId` を引く）

**API** `src/app/api/assets/[assetId]/route.ts`:
- `PATCH` body `{ status: "active" | "archived" }` → 更新して `{ ok: true }`。それ以外の status は 400。

**ページ** `src/app/assets/page.tsx`（client component、既存ページの流儀に合わせる）:
- 見出し「資産庫」＋説明1行「保存した投稿から抽出された、再利用できる型のライブラリ」
- 各資産をカード表示: `name`（太字）/ `structure` / `variableSlots` を Badge チップ / `transferScope` /
  `usageNote`（あれば）/ `tags` を小さいチップ / 出所カードへのリンク（`/posts/{sourcePostId}/learning`、
  `sourceCard` が null なら「元カードは削除済み」）/ アーカイブ切替ボタン
- archived はデフォルト非表示、「アーカイブを表示」トグルで出す
- 0件時: 「まだ型がありません。投稿を保存して学習カードを作ると、型が自動で貯まります」
- UI コンポーネントは `src/components/ui/`（Card, Button, Badge）を使う。新規デザインを発明しない

**ナビ**: グローバルナビの `/map` のリンクが定義されている場所を grep で特定し、同じ形式で
「資産庫 `/assets`」を追加（アイコンは lucide の `Library`）。

---

## 4. Phase B: 掛け合わせ push 最小版

### B-1. 型定義

`src/lib/ai/types.ts` に追加:

```ts
/** 掛け合わせエンジン（SeedThought 2 ステップ4最小版）の LLM 出力 */
export interface SynthesisOutput {
  /** 提案のタイトル。60字以内 */
  title: string;
  /** 切り口。何を軸に掛け合わせるか（1〜3文） */
  angle: string;
  /** なぜこの2つを掛けるのか。共通構造 or 緊張関係を明示（1〜3文） */
  reason: string;
  /** 読者の持ち帰り。1文 */
  takeaway: string;
  /** 発信の冒頭フック案。なければ null */
  seedHook: string | null;
}
```

`AiProvider` インターフェース（`types.ts` 392行付近）にメソッド追加:

```ts
generateSynthesis(input: SynthesisInput): Promise<SynthesisOutput>;
```

`SynthesisInput` は `{ materialA: SynthesisMaterial; materialB: SynthesisMaterial }`。
`SynthesisMaterial` は `{ kind: "card" | "pattern"; title: string; oneLiner: string; beforeAfter: string; patternSummary: string | null; tags: string[]; outputSeedAngle: string | null }`
（カードの decode / PatternAsset から組み立てる整形済みテキスト。組み立て関数は B-3 参照）。

`src/lib/ai/settings.ts`: `AiFeature` union（27行付近）に `"generateSynthesis"`、
ラベル表（37行付近）に `generateSynthesis: "掛け合わせ生成"`、機能リスト（111行付近）に追加。
`src/lib/ai/mockProvider.ts` にも固定値を返す実装を追加（テスト・モックモードが壊れるため必須）。

### B-2. ペア選定アルゴリズム（LLLMを使わない・決定的）

`src/lib/synthesis/selectPair.ts` を新規作成。**純関数**にする（DB アクセスは呼び出し側）。

```ts
interface PairCandidateCard {
  cardId: string;
  createdAt: Date;
  primaryCategory: string | null; // PostClassification.primaryCategory
  tags: string[];                 // decode.synthesisTags
}
interface PairCandidateAsset {
  assetId: string;
  learningCardId: string | null;
  tags: string[];
}
type SelectedPair =
  | { kind: "card_card"; cardAId: string; cardBId: string }
  | { kind: "card_pattern"; cardAId: string; patternAssetId: string }
  | null;

selectPair(cards, assets, usedPairKeys: Set<string>): SelectedPair
```

規則（この通りに実装。実装差が出ないように）:

1. タグ正規化: `tag.trim().toLowerCase()`（NFKC正規化はしない）。空タグは除外。
2. **card×card**: 全ペア (i<j) について `common = 正規化タグの共通数`。`common === 0` は候補外。
   `score = common * 10 + (primaryCategory が両方非nullかつ異なるなら 5)`。
3. **card×pattern**: 全組合せについて、`asset.learningCardId === card.cardId`（自分の出所カード）は除外。
   `common === 0` は候補外。`score = common * 10 + 3`。
4. ペアキー: card×card は `sort([cardAId, cardBId]).join(":")`、card×pattern は `cardId + ":" + assetId`。
   `usedPairKeys` に含まれるペアは除外（同日の再生成で同じ組合せを出さないため）。
5. 最高 score を採用。同点は「2素材の createdAt 合計が新しい方」→ それも同じなら cardId の辞書順で先。
   （card×pattern の createdAt は出所カードではなく比較不能なので、同点比較では card×card を優先する）
6. 候補ゼロのとき: 解読済みカードが2枚以上あれば **createdAt が新しい順の上位2枚**（フォールバック。
   タグが噛み合わなくても提案は出す）。1枚以下なら `null`。

呼び出し側（B-4 の route）でのデータ取得規則:
- カード候補 = `LearningCard` を `createdAt desc` で**最新30件**取得 → `outputJson` をパースし
  `decode?.synthesisTags?.length > 0` のものだけ候補にする。`primaryCategory` は
  `sourcePost.classification.primaryCategory`（include で引く。無ければ null）。
- 資産候補 = `PatternAsset` の `status: "active"` 全件。

### B-3. プロンプトと検品

`src/lib/ai/prompts.ts` に `buildSynthesisPrompt(input: SynthesisInput): string` を追加。
素材の整形（`SynthesisMaterial` の組み立て）は `src/lib/synthesis/buildMaterial.ts` に純関数で:
- カード → `title` = LearningCard.title、`oneLiner` = decode.oneLiner、
  `beforeAfter` = `「${before} → ${trigger} → ${after}」` 連結、
  `patternSummary` = extractedPattern があれば `${name}: ${structure}` なければ null、
  `outputSeedAngle` = decode.outputSeed.angle。
- 資産 → `title` = name、`oneLiner` = structure、`beforeAfter` = ""、`patternSummary` = `${name}: ${structure}（転用範囲: ${transferScope}）`、`outputSeedAngle` = null。

プロンプト本文（骨子。この要素と禁止則を必ず全部含める。文言の微調整は可）:

```
あなたは「掛け合わせエンジン」。2つの素材から、新しい発信ネタの種を1つ提案する。

ルール:
- 2つを並べて紹介するのではなく、「共通する構造」か「緊張関係（対立・補完）」を1つだけ特定し、それを軸にする
- 素材に書かれていない固有名詞・数字・事例・実績を創作しない
- 煽り・誇張表現（「革命」「震撼」「相乗効果」「シナジー」「覇権」など）を使わない
- takeaway は1文。読者が明日から使える形（行動 or 視点の転換）にする
- どちらか片方の素材だけで書ける提案は失格。両方が必須である理由を reason に書く

出力は次のJSONのみ: { "title", "angle", "reason", "takeaway", "seedHook" }

素材A: {kind / title / oneLiner / beforeAfter / patternSummary / tags / outputSeedAngle}
素材B: {同上}
```

few-shot として**良い例を1つ**プロンプトに埋め込む（下の §6 の「良い出力例」をそのまま使う）。

検品は LLM ではなく機械検証で行う（コスト最小化。decode の検品チェーンは使わない）。
`src/lib/ai/validation.ts` に `validateSynthesisOutput(raw: unknown): SynthesisOutput` を追加:
- `title/angle/reason/takeaway` が非空文字列でなければ throw
- `title` は 60 文字超で throw
- `angle + reason + takeaway` の連結に禁止語（`相乗効果` `シナジー` `革命` `震撼` `覇権`）が含まれたら throw
- `seedHook` は string か null に正規化（undefined → null）
- throw したら呼び出し側で**1回だけ**リトライ（decode と同様の流儀）。2回目も失敗なら提案なしにせず、
  素材情報だけの「素の提案」を保存する: `title = 素材Aタイトル × 素材Bタイトル`、
  `angle = reason = takeaway = ""` ではなく **生成失敗として扱い、その日の残り回数を消費しない**。
  route は 502 で `{ error: "generation_failed" }` を返し、UI は「生成に失敗しました。再試行」を出す。

### B-4. API

`dateKey` の計算（JST固定・全箇所共通）: `new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)`
を `src/lib/synthesis/dateKey.ts` の `todayKeyJst()` として1箇所に置く。

**`GET /api/synthesis/today`**（`src/app/api/synthesis/today/route.ts`）
1. 今日の `SynthesisSuggestion`（`dateKey = todayKeyJst()`）を `createdAt desc` で取得。
2. 1件以上あれば最新1件を返す（**LLMは呼ばない**。これがキャッシュ）。
3. 0件なら B-2 で選定 → B-3 で生成 → 保存 → 返す。素材不足（SelectedPair が null）なら
   `{ suggestion: null, reason: "no_materials", remainingRegenerations: 0 }`。
4. レスポンス: `{ suggestion: { id, status, title, angle, reason, takeaway, seedHook, collectionId, materials: [{ kind, title, href }] }, remainingRegenerations }`
   - `materials` の href: カードは `/posts/{sourcePostId}/learning`、型は `/assets`
   - `remainingRegenerations = max(0, 3 - 今日の行数)`

**`POST /api/synthesis/today/regenerate`**
- 今日の行数が 3 以上なら 429 `{ error: "daily_limit" }`
- 今日の既存行のペアキーを `usedPairKeys` にして B-2 → 生成 → 新規行を保存して返す（既存行は消さない。履歴）
- 新しいペアが無ければ 409 `{ error: "no_more_pairs" }`

**`POST /api/synthesis/[suggestionId]/accept`**
- 該当行が無ければ 404。処理:
  1. `Collection` を作成: `title = suggestion.title`、
     `idea` = angle + "\n\n" + reason + "\n\n持ち帰り: " + takeaway +（seedHook あれば "\n冒頭フック案: " + seedHook）
     +（card×pattern の場合、型の name/structure/transferScope を "\n\n使う型: ..." として追記）
  2. `CollectionItem` を作成: cardA（order 0）、cardB があれば cardB（order 1）。
     カードが既に削除されていたら存在するものだけ入れる。
  3. suggestion を `status: "accepted", collectionId` に更新
  4. `{ collectionId }` を返す
- **冪等**: すでに `accepted` で `collectionId` があれば、新規作成せずそれを返す（連打対策）

**`POST /api/synthesis/[suggestionId]/dismiss`**
- `status: "dismissed"` に更新して `{ ok: true }`。404処理は accept と同じ。

### B-5. ホーム UI

`src/app/page.tsx` に「今日の掛け合わせ」セクションを追加。**配置は TodayHero（今日の1本）の直上**。
（コンセプト文書の「ホーム＝今日の発見・今日の掛け合わせが待つ場所」に基づく。）

コンポーネントは `src/components/synthesis/TodaySynthesisCard.tsx` に切り出す（client component）。
マウント時に `GET /api/synthesis/today` を1回呼ぶ。状態と表示:

| 状態 | 表示 |
|---|---|
| loading | 既存 `TodayHeroSkeleton` と同トーンのスケルトン |
| `suggestion: null`（素材不足） | セクションごと**非表示**（空カードで場所を取らない） |
| `status: "proposed"` | 見出し「今日の掛け合わせ」/ 素材チップ2つ（リンク付き。`kind: "pattern"` は「型」バッジ付き）/ title（太字）/ angle / reason / takeaway（「持ち帰り:」ラベル付き）/ ボタン3つ |
| `status: "accepted"` | title と「コレクションで発信をつくる →」リンク（`/collections/{collectionId}`）だけのコンパクト表示 |
| `status: "dismissed"` | コンパクトに「今日はスキップしました」＋ remainingRegenerations > 0 なら「別の掛け合わせを見る」ボタン |
| 生成失敗（502） | 「生成に失敗しました」＋再試行ボタン（GET を再実行） |

ボタン3つ（proposed 時）:
- **「この掛け合わせでつくる」**（primary）→ accept → `router.push("/collections/" + collectionId)`
- **「別の掛け合わせ」**（ghost）→ regenerate。`remainingRegenerations` が 0 なら非表示。ボタンに「残り{n}回」を添える
- **「今日はスキップ」**（テキストリンク相当）→ dismiss

エラー時の文言・UI トーンは既存ホームの error Card に合わせる。ページ全体のレイアウト・既存セクションは崩さない。

---

## 5. 変更ファイル一覧（この範囲から出ない）

| 種別 | パス |
|---|---|
| 変更 | `prisma/schema.prisma`（2モデル追加 + LearningCard に1行） |
| 新規 | `prisma/migrations/20260709010000_add_asset_library_and_synthesis/migration.sql` |
| 新規 | `src/lib/assets/promotePattern.ts` |
| 新規 | `scripts/backfill-pattern-assets.ts` |
| 新規 | `src/lib/synthesis/selectPair.ts` / `buildMaterial.ts` / `dateKey.ts` |
| 変更 | `src/lib/ai/types.ts`（SynthesisOutput / SynthesisInput / AiProvider にメソッド） |
| 変更 | `src/lib/ai/settings.ts`（feature 登録3箇所） |
| 変更 | `src/lib/ai/prompts.ts`（buildSynthesisPrompt） |
| 変更 | `src/lib/ai/validation.ts`（validateSynthesisOutput） |
| 変更 | `src/lib/ai/provider.ts`（generateSynthesis 実装） |
| 変更 | `src/lib/ai/mockProvider.ts`（generateSynthesis 固定値実装） |
| 変更 | `src/app/api/posts/[postId]/learning/route.ts`（昇格フック1行＋import） |
| 新規 | `src/app/api/assets/route.ts` / `src/app/api/assets/[assetId]/route.ts` |
| 新規 | `src/app/api/synthesis/today/route.ts` / `today/regenerate/route.ts` / `[suggestionId]/accept/route.ts` / `[suggestionId]/dismiss/route.ts` |
| 新規 | `src/app/assets/page.tsx` |
| 新規 | `src/components/synthesis/TodaySynthesisCard.tsx` |
| 変更 | `src/app/page.tsx`（セクション挿入のみ） |
| 変更 | グローバルナビのファイル（/map を grep して特定。/assets を1件追加） |
| 新規 | テスト（§7 参照） |

---

## 6. 「良い」と「悪い」の見え方（掛け合わせ出力の品質基準）

### 良い出力例（few-shot にもこれを使う）

素材A = 「LLM に一発で正解を出させず、生成→自己検品の2段にする」というポストの解読。
素材B = 「営業は提案の場で考えるな、想定問答を先に書け」というポストの解読。

```json
{
  "title": "一発で決めない設計は、AIにも営業にも効く",
  "angle": "AIの2パス生成と営業の想定問答づくりは、どちらも「本番の一撃に賭けず、出力と検品を分離する」という同じ構造を持っている。この共通構造を軸に、仕事全般の準備論として語る。",
  "reason": "素材Aは機械の出力精度、素材Bは人間の対話品質と、領域は全く違うのに解決策の形が同一。異分野で同じ型が独立に発見されている事実が、型の普遍性の証拠になる。片方だけでは「AIテクニック」か「営業論」で終わり、この普遍性は語れない。",
  "takeaway": "大事な仕事は「つくる工程」と「疑う工程」を最初から別の時間に分けて予定に入れる。",
  "seedHook": "AIへの指示が上手い人と、営業が上手い人。全然違う分野なのに、やっていることが同じでした。"
}
```

良さの構成要素（レビュー時のチェック観点）:
- **共通構造が1つに特定されている**（「出力と検品の分離」）。並記ではない
- **両方が必須な理由**が reason に書かれている（片方で成立する提案は失格）
- takeaway が1文で、明日から実行できる
- 素材にない固有名詞・数字を足していない
- seedHook が Kotaro の文体基準に沿う（断定の煽りではなく共感シーン、平易、決め言葉なし）

### 悪い出力例（こうなっていたら実装かプロンプトの不備）

1. **抽象接着**: 「AIと営業、どちらも現代のビジネスに欠かせません。組み合わせれば相乗効果が…」
   → 共通構造の特定がない。禁止語も踏んでいる。validateSynthesisOutput で弾かれるべき
2. **並記**: 「まずAの2パス生成を紹介し、次にBの想定問答術を紹介する」→ 掛け合わせになっていない
3. **片翼**: title も angle も素材Aだけで書ける → reason に必須性が書けないはず
4. **創作**: 「営業成績が30%向上した事例もあり」→ 素材にない数字。即失格

### UI/挙動の「良い」

- ホームを開いて**2秒以内にスケルトン→当日分は即表示**（キャッシュヒット時にLLM待ちが発生しない）
- 同じ日に何度リロードしても提案が変わらない（regenerate したときだけ変わる）
- 採用→コレクション画面に着地し、idea 欄に掛け合わせの文脈が入っていて、そのまま生成に進める

---

## 7. テスト

### ユニットテスト（vitest。既存99件は全部通ったまま）

新規（純関数のみを対象。DBやLLMのモックテストは書かない — repo の既存流儀）:

1. `src/lib/synthesis/selectPair.test.ts`
   - 共通タグ2個のペアが1個のペアより優先される
   - 異カテゴリボーナス: 共通タグ数が同じなら異カテゴリペアが勝つ
   - card×pattern: 自分の出所カードとの組合せが除外される
   - `usedPairKeys` のペアが除外され、次点が選ばれる
   - 共通タグを持つペアがゼロ → 最新2枚フォールバック
   - 解読済み1枚以下 → null
   - 同点タイブレークが決定的（同じ入力で常に同じ出力）
2. `src/lib/ai/validation.test.ts` に追記: `validateSynthesisOutput`
   - 良い例（§6）が通る
   - title 61文字で throw / takeaway 空で throw / 「相乗効果」を含む angle で throw
   - `seedHook` undefined → null 正規化
3. `src/lib/synthesis/dateKey.test.ts`: 固定タイムスタンプ（`vi.setSystemTime`）で JST 日付が正しい。
   UTC 23:00 → JST 翌日になる境界ケースを含める

実行: `pnpm typecheck && pnpm test`。**両方緑になるまで完了と言わない。**

### 手動E2Eチェックリスト（ユーザーの dev サーバーで確認）

前提: `pnpm run db:deploy` → `pnpm run db:generate` → バックフィル実行済み。

- [ ] バックフィル: `pnpm exec tsx scripts/backfill-pattern-assets.ts` が件数を出力し、2回目の実行で件数が増えない
- [ ] `/assets` に型が一覧表示され、出所カードのリンクが学習ページに飛ぶ
- [ ] アーカイブ切替が動き、リロード後も維持される
- [ ] ホームに「今日の掛け合わせ」が出る（初回はLLM生成のため数秒〜十数秒かかってよい）
- [ ] リロードしても同じ提案（サーバーログに2回目のLLM呼び出しが無い）
- [ ] 「別の掛け合わせ」で違う組合せが出る。3回目以降はボタンが消える
- [ ] 「この掛け合わせでつくる」→ コレクションが作られ、idea に angle/reason/takeaway が入っている。連打しても1個しかできない
- [ ] 「今日はスキップ」→ コンパクト表示になる
- [ ] 新しい投稿で学習カードを生成 → 型があれば `/assets` に自動で増える
- [ ] 既存画面のリグレッション: 学習ページ・コレクション・レコメンドが従来どおり表示される（P2022 が出ない）

---

## 8. コミットとデプロイ

1. コミットは Phase A（スキーマ+資産庫）と Phase B（push）で分けてよいが、**マイグレーション適用（db:deploy）を済ませてからコミット**すること
2. push すると Vercel の build が `scripts/migrate-deploy.mjs` で同じマイグレーションを本番にも適用する。テーブル追加のみなので順序問題はない
3. デプロイ後の重い処理はない（LLM呼び出しは1回・軽量。Vercel Hobby の 300 秒制限は無関係）が、
   念のため `GET /api/synthesis/today` の route に `export const maxDuration = 60;` を付ける

---

## 9. 判断済みの設計（実装者は再検討しない）

- 掛け合わせの生成タイミングは **cron ではなくオンデマンド + dateKey キャッシュ**（コンセプト文書の未決定事項をこの仕様で決定とする）
- 採用の出口は**既存 Collection**（新しい生成パイプラインを作らない。Collection の idea 欄が掛け合わせ文脈の注入口）
- ペア選定は**LLMを使わない決定的アルゴリズム**（コスト・再現性・テスト容易性のため）
- 検品は機械検証のみ（decode のような LLM 検品チェーンは張らない。1日最大3回の軽い呼び出しに検品コストを掛けない）
- 型の重複排除はしない（同じ型が別カードから2回抽出されても2レコード。統合はステップ3以降の課題）
- SynthesisSuggestion の履歴は消さない（「掛け合わせの当たり」の記録が資産庫の一部）
