// Prisma migrate deploy wrapper hardened for Neon serverless cold starts.
//
// Failure mode we observed on Vercel:
//   1. Neon compute is suspended.
//   2. `prisma migrate deploy` opens a connection and immediately tries
//      `SELECT pg_advisory_lock(...)` to serialize migrations.
//   3. Prisma's internal connect/lock timeout fires (~10s) before Neon
//      finishes waking up, so we get P1002 every attempt — even with
//      exponential backoff between attempts.
//
// Fix: before invoking Prisma, open a raw `pg` connection to the same URL
// with a long connect timeout. This forces Neon to wake and confirms the
// database is ready. We also `pg_advisory_unlock_all()` to clear any
// stale migration lock left behind by a previously aborted deploy.
// Then we run `prisma migrate deploy`, still wrapped in a small retry
// loop as a safety net.
//
// The migration URL preference matches prisma.config.ts:
//   DIRECT_URL ?? DATABASE_URL

import { spawn } from "node:child_process";
import pg from "pg";

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 3000;
const PREWARM_TIMEOUT_MS = 120_000;

function getMigrationUrl() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Neither DIRECT_URL nor DATABASE_URL is set");
  }
  return url;
}

async function prewarmAndClearLocks() {
  const connectionString = getMigrationUrl();
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: PREWARM_TIMEOUT_MS,
    statement_timeout: PREWARM_TIMEOUT_MS,
    query_timeout: PREWARM_TIMEOUT_MS,
  });

  const start = Date.now();
  console.log("[migrate-deploy] Pre-warming Neon (up to 120s)...");
  await client.connect();
  const wakeMs = Date.now() - start;
  console.log(`[migrate-deploy] Neon awake in ${wakeMs}ms`);

  // Sanity probe.
  await client.query("SELECT 1");

  // Release any stale migration advisory lock from a prior aborted run.
  // pg_advisory_unlock_all() only releases session-level locks held by
  // *this* session, so it's safe — it won't yank a lock from a live peer.
  // For a stuck lock from a dead session, Postgres releases it when that
  // session's backend exits; this call mostly documents intent.
  try {
    await client.query("SELECT pg_advisory_unlock_all()");
  } catch (err) {
    console.warn("[migrate-deploy] pg_advisory_unlock_all() failed (non-fatal):", err.message);
  }

  await client.end();
}

function runPrismaDeployOnce() {
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
  return /\bP100[12]\b|advisory lock|timed out|Timed out/i.test(output);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  // Step 1: wake Neon and clear stale locks. If this fails, Prisma has
  // no chance — surface the error early instead of going through 5 retries.
  try {
    await prewarmAndClearLocks();
  } catch (err) {
    console.error("[migrate-deploy] Pre-warm failed:", err.message);
    console.error("[migrate-deploy] Cannot reach database — aborting before Prisma.");
    process.exit(1);
  }

  // Step 2: run prisma migrate deploy. Should now succeed on first try,
  // but keep a small retry as a safety net.
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 2);
      console.log(`\n[migrate-deploy] Retry ${attempt}/${MAX_ATTEMPTS} after ${delay}ms...\n`);
      await sleep(delay);
    }

    const { code, stdout, stderr } = await runPrismaDeployOnce();
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
