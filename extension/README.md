# SeedThought Clipper（ブラウザ拡張）

note / Zenn / Qiita / ブログなど、X以外のWebページを SeedThought に送るための Chrome 拡張機能（Manifest V3）。

## できること

- ページを開いた状態で拡張アイコンをクリック → 「このページを送る」で SeedThought に保存
- 右クリック → 「SeedThoughtに送る」（ページ全体／選択範囲／リンク先 のいずれにも対応）
- 取り込まれた投稿は、SeedThought 側で自動分類され、学習カードを生成できる状態になります

## セットアップ（開発用にローカル読み込み）

1. SeedThought 本体を起動しておく（`pnpm dev` または `pnpm preview` で `http://localhost:3003` を確認）。
2. Chrome で `chrome://extensions` を開く。
3. 右上の「デベロッパーモード」を ON。
4. 「パッケージ化されていない拡張機能を読み込む」をクリックし、このリポジトリの `extension/` フォルダを選択。
5. 拡張アイコンを右クリック → 「オプション」を開き、「SeedThoughtのURL」を入力（例: `http://localhost:3003`）。本番では Vercel のドメインに変更。
6. 必要に応じて拡張トークンを設定（サーバ側 `.env` の `EXTENSION_TOKEN` と同じ値）。

## 動作確認

1. 任意の note / Zenn / Qiita 記事を開く。
2. 拡張アイコンをクリック → 「このページを送る」。
3. SeedThought の `/posts` 一覧に新しい投稿として追加されることを確認。
4. その投稿の「学習する」ボタンから、通常の学習カード生成フローに乗ることを確認。

## サーバ側の必要条件

- POST `/api/posts` がOPTIONSプリフライトに対応していること（CORS対応済み）
- 公開デプロイで第三者からの書き込みを防ぐ場合は、サーバ側 `.env` に
  `EXTENSION_TOKEN="長いランダム文字列"` を設定し、拡張オプションでも同じ値を入力

## X Article 自動取得

X (Twitter) の長文記事ページ（`x.com/i/article/<id>`）は X API 非公開のため、ユーザーのログイン済みブラウザセッションを使って本文を取得します。

### 何が起きるか

1. X 同期でいいね・ブックマーク内に X Article URL が検出されると、そのポストの `enrichmentStatus` が `x_article_pending` に設定される。
2. 拡張の service worker が **5 分おき**に `/api/x/article-body?limit=5` を呼び出してキューを取得する。
3. 各 Article URL を背景タブ（非アクティブ）で開き、ページが読み込まれたらページ内のテキストを抽出して `/api/x/article-body` (POST) に送信する。
4. サーバー側でポストの `text` が記事本文に上書きされ、`enrichmentStatus` が `done` になる。

### popup ボタン「X Article 取得を今すぐ実行」

拡張アイコンをクリックして表示されるポップアップに「X Article 取得を今すぐ実行」ボタンがあります。5 分を待たずに手動でキューを処理したいときに使います。

### 必要な設定

- **送信先 URL**（例: `http://localhost:3003` または Vercel のドメイン）— 拡張オプション画面で設定
- **拡張トークン**（任意）— サーバー側 `.env` の `EXTENSION_TOKEN` と同じ値を拡張オプションに設定。未設定の場合は認証なしで動作（ローカル開発向け）

### DOM 抽出について

X Article ページから `<article>` 要素などを探してテキストを抽出します。抽出結果が 100 文字未満の場合は失敗扱いとし、ポストは `x_article_pending` のまま次回リトライされます。X 側の DOM 構造変更でセレクタが当たらなくなった場合は `extension/background.js` 内の `ARTICLE_SELECTORS` を更新してください。

## ファイル構成

- `manifest.json` — MV3 マニフェスト
- `background.js` — 右クリックメニュー・送信処理・X Article ポーラ（service worker）
- `popup.html` / `popup.js` / `popup.css` — 拡張アイコンクリック時の小窓
- `options.html` / `options.js` — 送信先URLとトークン設定
