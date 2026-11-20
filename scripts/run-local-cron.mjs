// Local stand-in for the Supabase schedule: calls GET /api/cron/sync every minute, like
// pg_cron + pg_net do in the hosted project. The hosted scheduler cannot reach localhost.
//
// Usage: pnpm dev (in one terminal), then pnpm cron:local (in another).
// Reads APP_URL and CRON_SECRET from .env.local. Pass --once to run a single cycle.
// The secret is sent in the Authorization header and never printed.

const INTERVAL_MS = 60_000;
const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
const secret = process.env.CRON_SECRET;
const once = process.argv.includes("--once");

if (!secret) {
  console.error("CRON_SECRET is not set. Add it to .env.local (see .env.example).");
  process.exit(1);
}

async function runCycle() {
  const startedAt = new Date();
  try {
    const response = await fetch(`${appUrl}/api/cron/sync`, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(INTERVAL_MS),
    });
    const body = await response.text();
    console.log(`[${startedAt.toISOString()}] ${response.status} ${body}`);
    return response.ok;
  } catch (error) {
    console.error(`[${startedAt.toISOString()}] request failed: ${error.message}`);
    return false;
  }
}

if (once) {
  process.exit((await runCycle()) ? 0 : 1);
}

console.log(`Calling ${appUrl}/api/cron/sync every minute. Stop with Ctrl+C.`);
await runCycle();
setInterval(runCycle, INTERVAL_MS);
