<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Fetching blocked URLs (X / Twitter など)

X や bot 対策サイトを直接 `fetch` しても内容が取れない場合は `https://r.jina.ai/` を URL の前に付けて取得を試みる。

例: `https://r.jina.ai/https://x.com/user/status/1234567`

- 単発の公開ポスト本文は取れることが多い（不安定・確率的）
- ツリー（返信・連投）・メディア説明は返ってこない
- ログイン壁（"Don't miss what's happening" 等）が返ったら失敗とみなす
