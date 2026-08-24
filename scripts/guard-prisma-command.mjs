// PreToolUse hook for the `prisma-guard` subagent.
//
// Blocks the Prisma commands that can destroy production data. This repo's
// DATABASE_URL points at the *production* Neon database (local and prod share
// one instance), and `prisma migrate dev` reacts to the known, deliberate
// schema drift by proposing `prisma migrate reset` — which drops every row.
//
// A prompt-level "don't run this" is advisory. This is not: exit code 2 blocks
// the tool call and returns the message to the agent.
//
// Contract: Claude Code writes the PreToolUse payload as JSON on stdin and
// treats exit 2 as "block, and show stderr to the model".

const FORBIDDEN = [
  { pattern: /prisma\s+migrate\s+dev/i, why: "migrate dev は drift を検出して reset（本番全データ削除）を提案してくる" },
  { pattern: /prisma\s+migrate\s+reset/i, why: "migrate reset は本番の全データを削除する" },
  { pattern: /prisma\s+db\s+push/i, why: "db push はマイグレーション履歴を残さずスキーマを上書きする" },
  { pattern: /\bdb:migrate\b/, why: "package.json の db:migrate は prisma migrate dev のエイリアス" },
  { pattern: /\bdb:reset\b/, why: "package.json の db:reset は prisma migrate reset --force のエイリアス" },
];

const CORRECT_PROCEDURE = `
正しい手順（この順序を守ること）:
  1. prisma/schema.prisma を編集
  2. prisma/migrations/<YYYYMMDDHHMMSS>_<name>/migration.sql を手動作成
     （既存データを壊さない追記のみ。破壊的DDLは書かない）
  3. pnpm run db:deploy   ← migrate deploy。drift検出なし
  4. pnpm exec prisma generate
  ※ 3 と 4 を逆にすると P2022 ColumnNotFound でアプリ全体が壊れる
`.trim();

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let command = "";
try {
  command = JSON.parse(raw)?.tool_input?.command ?? "";
} catch {
  // Unparseable payload: fail open rather than blocking every Bash call.
  process.exit(0);
}

const hit = FORBIDDEN.find((f) => f.pattern.test(command));
if (hit) {
  console.error(
    `[prisma-guard] このコマンドはこのリポジトリで禁止されています。\n` +
      `  コマンド: ${command}\n` +
      `  理由: ${hit.why}\n\n${CORRECT_PROCEDURE}`
  );
  process.exit(2);
}

process.exit(0);
