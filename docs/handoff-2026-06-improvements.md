# 改善タスク ハンドオフ仕様（2026-06）

実装担当: Sonnet / 設計: Opus。本ドキュメント単体で着手できるよう、各タスクに「目的・対象ファイル・変更内容・受け入れ基準・注意」を記載する。

## 共通の前提（必読）

- **Next.js はカスタム版**。API/規約/ファイル構成が学習データと異なる場合がある。コードを書く前に `node_modules/next/dist/docs/` の該当ガイドを読む。非推奨警告に従う。
- **デプロイ可否は `tsc` で判断**（`next build` は ESLint を走らせない）。既存の set-state-in-effect 警告は非ブロッカー。
- **preview server を二重起動しない**（ユーザーの :3000 が `.next` ロックを保持）。確認は `tsc` ＋構造レビューで行う。
- **課金APIをデフォルトで増やさない**。重い/有料の処理はオプトイン・冪等化する。
- **DB は PostgreSQL**（本番）。スキーマ変更時は `prisma/schema.prisma` 更新＋マイグレーション追加。

## 全体の確定事項

- **画像読取（ビジョン）は手動のまま**。自動取得の対象は「ツリー」「リンク情報」の2つのみ（T2）。
- **X連携の「接続状態」は Grok OAuth とは別物**（前者=いいね/BM読取の `XAccount`、後者=LLM用 `XAuth`）。削除せずラベルで区別する（T5）。
- **item 2/3/4 は単一の `/api/app/heartbeat` に集約**して実装する（T6）。

---

# フェーズ1：低リスクなUI/挙動の修正

## T1. 投稿詳細のモデル選択がスマホで枠を飛び出す

- **対象**: `src/app/posts/[postId]/confirm/page.tsx`（生成モデルブロック 〜941-980行付近）
- **原因**: flex 子要素の既定 `min-width:auto` により、長いモデル名が `<select>` を押し広げてカード幅を超える。
- **変更**:
  - モデル `<select>`/`<input>` を包む `<div className="flex flex-1 items-center gap-2">`（957行付近）に `min-w-0` を追加。
  - プロバイダ `<select>`（942行付近）・モデル `<select>`（959行付近）・手入力 `<input>`（969行付近）に `min-w-0`（必要なら `w-full`）を追加。
- **受け入れ基準**: iPhone幅（375px）想定で、長いモデルID（例: `claude-opus-4-20250514` 等）を選んでもカード右端を越えない／横スクロールが出ない。PC表示は従来通り横並び。

## T2. ツリー・リンク情報を自動取得（画像は手動のまま）

- **対象**: `src/app/posts/[postId]/confirm/page.tsx`
- **既存の部品**:
  - ツリー: `handleFetchThread`（192行〜）、ガード `canFetchThread`（456行: like/bookmark由来かつ `sourcePostId` あり）、取得済み判定 `post.threadPosts.length`
  - リンク: `handleEnrichLinks`（225行〜）、取得済み判定 `relatedLinks.length`
- **変更**: 投稿ロード完了後に1回だけ走る `useEffect` を追加し、未取得のものだけ自動実行。
  - ツリー: `canFetchThread && (post.threadPosts?.length ?? 0) === 0 && !fetchingThread` → `handleFetchThread()`
  - リンク: `relatedLinks.length === 0 && !enrichingLinks` → `handleEnrichLinks()`（投稿本文にURLが含まれる時のみ。URL無しなら叩かない）
  - 2つは並列でOK。**画像読取（`handleAnalyzeImages`）は呼ばない**（手動のまま）。
  - 「1投稿につき自動実行は1回」を保証するため `useRef(false)` でガードし、再レンダー/再オープンで再発火しない（取得済み判定との二重ガード）。
- **手動ボタンは残す**（「ツリーを再取得」「リンク情報を取得」）。
- **注意**: ツリー取得は X API（レート制限あり）。冪等ガードで「既に `threadPosts` がある投稿」では絶対に再取得しないこと。エラー時は既存の `threadError`/`enrichError` 表示にそのまま乗せ、自動実行であることを理由に黙殺しない。
- **受け入れ基準**: like/bookmark由来の投稿詳細を開くと、操作なしでツリーとリンクが順次埋まる。リロードしても再取得APIが発火しない（ネットワークタブで確認）。記事/YouTube/リサーチ由来など `canFetchThread=false` の投稿ではツリーAPIを叩かない。

## T3. X発信のコピー結果からマークダウン記号（＃ 等）を除去

- **背景**: X出力に `## 見出し` や `＃`、`**強調**` が混ざり、Xに貼るとそのまま表示される。note は媒体側がMD描画するため問題化しない。
- **対象**:
  1. 新規ユーティリティ `src/lib/text/markdown.ts`
  2. 表示/コピー: `src/components/outputs/OutputPreview.tsx`
  3. 生成プロンプト: `src/lib/ai/outputKnowledge.ts`（`outputMediumKnowledge.x` 77-87行）
- **変更**:
  - `stripMarkdownForX(text: string): string` を実装。**やること**:
    - 行頭の見出し記号を除去: `/^[ \t　]*[#＃]{1,6}[ \t　]+/gm` → 空文字（見出しテキストは残す）
    - 強調記号の除去: `**text**`/`__text__` → `text`、`` `code` `` → `code`
    - **ハッシュタグ `#AI` のような「#＋空白なし」は残す**（見出し `# ` とは別物）。全角 `＃` も見出し用途のみ除去対象。
    - 末尾の過剰な空行を整理（任意）。
  - `OutputPreview.tsx`:
    - 「Default display」の表示テキストとコピー（`handleCopy`、74-78行 / 531-534行）で、`outputType === "x"` のときだけ `stripMarkdownForX(content)` を通す。元の `content` は保持し、`displayContent`/コピー値だけ加工する。
    - 「Xに投稿」(`handlePostToX`) で送る本文も同様に加工した値にする（貼り付けと投稿の挙動を一致させる）。
  - `outputKnowledge.ts` の X 指示に1行追加: 「**見出し記号(`#`/`＃`)・太字`**`・マークダウンのリスト記法は使わず、Xにそのまま貼れるプレーンテキストで書く**（ハッシュタグは可）」。
- **受け入れ基準**:
  - 既存DBのX生成（`## 見出し` 入り）を表示/コピーすると見出し記号が消え、見出し語は残る。
  - `#AI活用` のようなハッシュタグは消えない。
  - note/seminar/strict_learning など他媒体の表示・コピーは一切変わらない。
  - `stripMarkdownForX` の単体テスト（`src/lib/text/markdown.test.ts`）を追加（見出し全角/半角、太字、ハッシュタグ保持、コードスパンの4ケース最低）。

## T4. 「AIに聞く」のリサーチ／アカウント分析の履歴を削除可能に

- **背景**: 履歴は3系統。質問(chat)=全削除あり、検索(search)=個別削除あり/全削除なし、**リサーチ/アカウント分析(`ResearchSession`)=削除手段ゼロ**。
- **対象**:
  1. 新規 `src/app/api/research/[id]/route.ts`（`DELETE`）
  2. 任意で `src/app/api/research/route.ts` に `DELETE`（全削除）
  3. `src/app/chat/page.tsx`
- **変更**:
  - `DELETE /api/research/[id]`: `prisma.researchSession.delete({ where: { id } })`。存在しないIDは404、成功で `{ ok: true }`。
  - `chat/page.tsx`:
    - リサーチ履歴チップ（722-745行）とアカウント分析履歴チップ（827-851行）に、検索履歴と同じ「×」ボタンを付ける。クリックで `DELETE /api/research/[id]` → 成功したら `setResearchHistory((prev) => prev.filter(h => h.id !== id))`。チップ本体クリック（再実行）と×クリックを `stopPropagation` で分離。
    - 検索(search)モードに「履歴をクリア」を追加（`localStorage.removeItem(SEARCH_HISTORY_KEY)` ＋ `setSearchHistory([])`）。リサーチ/分析にも「すべて削除」を置くなら全削除APIを使用。
- **受け入れ基準**: リサーチ/アカウント分析の履歴チップを個別に消せ、リロード後も消えている（サーバ反映）。検索履歴を一括クリアできる。

## T5. X連携ページの「接続状態」を「Xアカウント連携」にリネーム

- **対象**: `src/app/settings/x/page.tsx`（295-296行付近）
- **変更**: カード見出し `接続状態` → `Xアカウント連携`。サブ説明があれば「いいね・ブックマークの取り込みに使います」を1行添える。**カード自体は削除しない**（同期設定の前提）。
- **受け入れ基準**: ページ上で「Xアカウント連携」と「Grok OAuth連携」が別カードとして役割が分かる。

---

# フェーズ2：連携基盤（item 2 / 3 / 4 を集約）

## T6. アプリ起動時ハートビート：自動同期＋トークン延命＋連携切れバナー

3つの要望を1エンドポイント＋1バナーで満たす。

- **要望対応**:
  - item 2: アプリを開くだけでX同期が走る（X連携ページに行かなくてよい）
  - item 3: Grok OAuth の refresh をユーザー活動（=起動）契機でも温め、daily cron より延命
  - item 4: Grok連携切れを全ページ上部に常時表示
- **新規エンドポイント** `src/app/api/app/heartbeat/route.ts`（`GET`, `runtime=nodejs`, `dynamic=force-dynamic`）:
  1. 接続状態を取得して即返す: Grok=`findXaiAuth()`＋APIキー有無（`/api/grok/status` と同じ判定 `connected`/`fallbackActive`）、X=`XAccount` 有無、`lastSyncAt`（最新 `XSyncRun.startedAt`）。
  2. **副作用は `after()` で非同期**（レスポンスをブロックしない）:
     - Grokトークン: `refreshStoredXaiTokens()` をベストエフォートで実行（失敗は握りつぶしログのみ。`refresh.ts` の既存挙動＝失効時はトークン削除に従う）。
     - X同期スロットル: Xが接続済み かつ 直近の `XSyncRun` が「running でない」かつ `startedAt` が **クールダウン（6時間）より前** のときだけ `syncXPosts("both", 25)` を起動。多タブ/連続リロードでの多重発火を `XSyncRun` の状態で防ぐ。
  3. レスポンス例: `{ grok: { connected, fallbackActive }, x: { connected, lastSyncAt }, sync: { triggered } }`
  - 認証は不要（本アプリは単一ユーザー・既存APIも未認証）。CRON_SECRET は付けない。
- **クライアント**:
  - `src/components/layout/AppShell.tsx`: マウント時に1回 `GET /api/app/heartbeat` を叩き、結果を state 保持。`window` の `focus` イベントでも再取得（前回から数分のスロットルを入れて連打を防ぐ）。
  - 新規 `src/components/layout/ConnectionBanner.tsx`: heartbeat結果を受け取り `<main>` の最上部（`children` の直前）に描画。
    - `grok.connected === false && grok.fallbackActive === false` → 赤系「Grok連携が切れています」＋「再接続」リンク（`/settings/x`）。
    - `grok.fallbackActive === true` → 黄系「APIキーで代替稼働中（サブスク枠を使うには再接続）」。
    - それ以外（接続中）→ 何も出さない。
- **注意**:
  - X同期は X API レート制限があるため、クールダウン6時間は必ず守る（短くしない）。同期は背景実行で、UIをブロックしない・通知は最小限（バナー/トーストは任意）。
  - item 3 の「有効期間そのもの」は xAI 側ポリシー依存。**着手前にメモ方針（`feedback_verify_current_info`）に従い、xAI OAuth の refresh_token TTL／無活動失効ウィンドウを公式ドキュメントで確認**し、起動契機＋daily cron で十分温まるかを裏取りすること（確認した事実は出典URL＋日付でメモ化）。仕組み自体は既に `client.ts`（使用10分前）＋`cron/x-sync`（daily）で実装済みで、本タスクは「起動契機の追加リフレッシュ」を足すもの。
- **受け入れ基準**:
  - Grok未接続（APIキーも無し）状態でどのページを開いても上部に赤バナーが出る。フォールバック時は黄バナー。接続中は無表示。
  - X接続済みで最後の同期が6時間以上前なら、任意のページを開くだけで背景同期が1回走る（`XSyncRun` が増える）。6時間以内のリロードでは新たな同期が走らない。
  - heartbeat のレスポンスが副作用完了を待たず即返る（体感ブロックなし）。

---

# フェーズ3：蓄積を活かす（item 1 / 5）— 要設計

> item 1 と item 5 は同じ「蓄積→提案」エンジンを共有する。先に T7 を作り、T8 はそこへ接続する。

## T7. コレクションのおすすめ

- **目的**: 学びカードが特定テーマに溜まったら「◯◯まとめコレクションにしませんか？」と提案し、ワンクリックで既存の作成フローへ。
- **既存の流れ（再利用）**: コレクション作成ページは `?cardId=...&cardId=...` を受け取ると作成フォームを自動展開し `generate-meta` でタイトル自動生成する（`src/app/collections/page.tsx` 88-107行）。提案はこのURLへ送るだけでよい。
- **新規エンドポイント** `src/app/api/collections/suggestions/route.ts`（`GET`）:
  - 学びカード（`LearningCard` + `sourcePost.classification`）を取得。
  - 既に `CollectionItem` に含まれる `learningCardId` を除外（=未コレクション化のみ対象）。
  - `primaryCategory`（と必要ならタグ）でクラスタリングし、件数を集計。
  - 閾値（**5枚以上**）を超えたクラスタを提案化: `{ key, label, cardIds, count, sampleTitles }`。`label` は暫定（例: `「${category}」まとめ`）。最終タイトルは作成時の generate-meta が決める。
  - 件数降順で上位3件返す。既存コレクションのタイトルとほぼ一致するクラスタは除外（任意）。
- **UI** 新規 `src/components/collections/CollectionSuggestions.tsx`:
  - `collections/page.tsx` の一覧上部に表示。「『AI活用』の学びが8枚たまっています。コレクションにまとめますか？」＋「作る」ボタン → `router.push("/collections?cardId=...&cardId=...")`（既存プリフィル発火）。
  - 「あとで」（dismiss）: `localStorage` に `key` を保存して一定期間（例: 14日）非表示。
- **受け入れ基準**: 同一カテゴリの未コレクション化カードが5枚以上あると提案カードが出る。「作る」で作成フォームが対象カード選択済み＋タイトル自動生成済みで開く。「あとで」で当該提案がしばらく消える。

## T8. 知識マップ／保存傾向に「出口」を付ける（item 1）

「眺めて終わり」を「次の行動」へ繋ぐ最小実装。T7 のフローへ合流させる。

- **知識マップ** `src/app/map/page.tsx`（ノード詳細パネル 641-734行）:
  - ノード選択時の詳細パネルに「関連カードをまとめてコレクション化」ボタンを追加。`selectedNode.id`（=`LearningCard.id`）＋ `adjacentIds`（隣接カードID群）を集めて `/collections?cardId=...` へ遷移（T7と同じプリフィル）。
  - 既存の「学習カードを開く」リンクはそのまま。
- **保存傾向** `src/app/insights/page.tsx`（「次に学ぶとよいトピック」221-231行）:
  - 各トピックを `/chat?mode=research&q=<topic>`（または `mode=search`）へのリンク化。
  - これに合わせて `src/app/chat/page.tsx` に `?q=` 受け取りを追加（初回マウントで `mode` に応じ `researchQuery`/`query` をプリフィル。`mode=research|search` も既存の `mode` 解釈に追加）。
- **受け入れ基準**: マップのノード詳細から関連カードをコレクション作成に持ち込める。保存傾向の「次に学ぶトピック」をクリックすると、そのトピックが入力済みの状態でリサーチ/検索が開く。
- **注意**: ここはUXの肝なので、まず最小（リンク化＋ボタン）で出し、過剰な自動クラスタ可視化は入れない。

---

# 推奨着手順

1. **フェーズ1**（T1 → T5 → T3 → T4 → T2）: 体感が早く出る低リスク群。
2. **フェーズ2**（T6）: heartbeat 基盤（item 2/3/4 を一括）。着手前に xAI トークンポリシーを確認。
3. **フェーズ3**（T7 → T8）: 提案エンジン → マップ/傾向の出口を接続。

# スコープ外 / 確定済み判断

- 画像読取（ビジョン）の自動化は**やらない**（手動維持）。
- X連携の「接続状態」カードは**削除しない**（リネームのみ）。
- 各タスクはなるべく独立PR/コミットに分割可能。フェーズ跨ぎの依存は T8→T7 のみ。
