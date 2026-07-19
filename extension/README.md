# SeedThought Clipper（ブラウザ拡張）

note / Zenn / Qiita / ブログなど、X以外のWebページを SeedThought に送るための Chrome 拡張機能（Manifest V3）。

## できること

- ページを開いた状態で拡張アイコンをクリック → 「このページを送る」で SeedThought に保存
- 右クリック → 「SeedThoughtに送る」（ページ全体／選択範囲／リンク先 のいずれにも対応）
- X 同期で `x_article_pending` になった X Article を、ログイン済みのブラウザセッションで自動取得
- 取り込まれた投稿は、SeedThought 側で自動分類され、学習カードを生成できる状態になります

## セットアップ（開発用にローカル読み込み）

1. SeedThought 本体を起動しておく（`pnpm dev` または `pnpm preview` で `http://localhost:3003` を確認）。
2. Chrome で `chrome://extensions` を開く。
3. 右上の「デベロッパーモード」を ON。
4. 「パッケージ化されていない拡張機能を読み込む」をクリックし、このリポジトリの `extension/` フォルダを選択。
5. 拡張アイコンを右クリック → 「オプション」を開き、「SeedThoughtのURL」を入力（例: `http://localhost:3003`）。本番では Vercel のドメインに変更。
6. 必要に応じて拡張トークンを設定（サーバ側 `.env` の `EXTENSION_TOKEN` と同じ値）。
7. 「X Article自動取得を有効にする」を確認し、15 / 30 / 60 分から間隔を選んで保存（初期値はON・30分）。

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

### 自動取得の挙動

1. X 同期でいいね・ブックマーク内に X Article URL が検出されると、そのポストの `enrichmentStatus` が `x_article_pending` に設定される。
2. 拡張の service worker が設定した間隔（初期値30分）で `/api/x/article-body?limit=3` を呼び出し、最大3件を取得する。
3. 各 Article URL を `active: false` の背景タブで開き、タブの読み込み完了を待ってからページ内のテキストを `chrome.scripting.executeScript` で抽出する。
4. 抽出に成功した本文を `postId`、`articleUrl`、`title`、`body` とともに `/api/x/article-body` (POST) に送信し、タブを閉じる。
5. 同じサイクル内の次の記事へは5〜10秒のランダムな間隔を置く。サイクルは最大3件で終了する。

service worker が停止しても処理を失わないよう、処理中のジョブと失敗記録は `chrome.storage.local` に保存します。タブ完了、再試行、件間待機、タイムアウトはタブイベントまたは単発 `chrome.alarms` で再開します。

### 失敗時の挙動

- ログイン壁、未ログイン、DOM未描画などで本文が30文字未満の場合はPOSTしません。
- 抽出に失敗した `articleUrl` は `chrome.storage.local` に記録し、24時間は同じURLを再試行しません。
- 1サイクルの全件が失敗した場合は `chrome.notifications` で通知します。同じ失敗が続く間は通知を繰り返さず、1件でも成功すると通知状態をリセットします。
- X Article の取得には、対象Xページをログイン済みで開けるChromeプロファイルが必要です。拡張がブラウザに読み込まれているだけではXのログイン状態は作られません。

### オプション画面

- **X Article自動取得** — 自動ポーリングのON/OFF。初期値はON。
- **自動取得の間隔** — 15分 / 30分 / 60分。初期値は30分。
- 「X Article 取得を今すぐ実行」ボタンでは、ON/OFFに関係なく手動で1サイクルを開始できます。

### DOM 抽出について

X Article ページから記事専用要素、OGメタ、本文の順にテキストを抽出します。抽出結果が30文字未満の場合は失敗扱いとし、ポストは `x_article_pending` のままになります。X 側の DOM 構造変更でセレクタが当たらなくなった場合は `extension/background.js` と `extension/extractXArticle.js` のセレクタを更新してください。

## ファイル構成

- `manifest.json` — MV3 マニフェスト（`alarms` 権限を含む）
- `background.js` — 右クリック・送信処理・X Article 自動取得の状態機械
- `extractXArticle.js` — X Article DOM 抽出ロジック（手動/デバッグ実行用）
- `popup.html` / `popup.js` / `popup.css` — 拡張アイコンクリック時の小窓
- `options.html` / `options.js` — 送信先URL、トークン、自動取得設定