// Prisma migrate deploy with retry on Neon cold-start timeouts.
// Neon serverless Postgres can take >10s to wake when suspended,
// which makes `prisma migrate deploy` fail with P1002 while trying
// to acquire pg_advisory_lock. We retry with exponential backoff.

import { spawn } from "node:child_process";

const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 3000;

function runOnce() {
  return new Promise((resolve) => {
    const child = spawn("pnpm", ["exec", "prisma", "migrate", "deploy"], {
      stdio: ["inherit", "pipe", "pipe"],
      shell: process.platform === "win32",
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      const s = data.toString();
      stdout += s;
      process.stdout.write(s);
    });
    child.stderr.on("data", (data) => {
      const s = data.toString();
      stderr += s;
      process.stderr.write(s);
    });

    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function isRetryableError(output) {
  // P1002: timeout reaching the database
  // P1001: can't reach database (Neon cold start)
  // advisory lock timeout
  return /\bP100[12]\b|advisory lock|timed out|Timed out/i.test(output);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 2);
      console.log(`\n[migrate-deploy] Retry ${attempt}/${MAX_ATTEMPTS} after ${delay}ms (Neon cold-start?)...\n`);
      await sleep(delay);
    }

    const { code, stdout, stderr } = await runOnce();
    if (code === 0) {
      if (attempt > 1) {
        console.log(`[migrate-deploy] Succeeded on attempt ${attempt}`);
      }
      process.exit(0);
    }

    const combined = `${stdout}\n${stderr}`;
    if (!isRetryableError(combined)) {
      console.error(`[migrate-deploy] Non-retryable error (exit ${code}), aborting`);
      process.exit(code);
    }

    if (attempt === MAX_ATTEMPTS) {
      console.error(`[migrate-deploy] All ${MAX_ATTEMPTS} attempts exhausted`);
      process.exit(code);
    }
  }
}

main().catch((err) => {
  console.error("[migrate-deploy] Unexpected error:", err);
  process.exit(1);
});
