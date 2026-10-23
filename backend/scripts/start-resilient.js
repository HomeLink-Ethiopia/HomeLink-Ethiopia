/**
 * Resilient backend runner.
 *
 * Problem it solves: on this network, DNS to MongoDB Atlas intermittently fails
 * (querySrv ECONNREFUSED / ENOTFOUND). The team's db.js silently falls back to an
 * in-memory MOCK store when Atlas is unreachable — the API looks alive but data
 * never reaches the real database. That is exactly what we must avoid when
 * verifying registrations against Kidist's Atlas DB.
 *
 * This runner:
 *  1. Builds a non-SRV mongodb:// URI from the .env SRV URI (skips flaky SRV DNS).
 *  2. Spawns server.js, watching its output:
 *       - "MongoDB connected successfully" -> good, stay up.
 *       - "[MOCK DB ACTIVATED]"            -> kill it, retry (DNS flake / whitelist).
 *  3. Retries up to MAX_TRIES with a delay, then gives up loudly.
 *
 * Usage: node scripts/start-resilient.js
 */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const LOG_DIR = path.join(ROOT, "..", ".freebuff");
const MAX_TRIES = 40; // ~20 minutes at 30s intervals
const RETRY_DELAY_MS = 30_000;

function buildNonSrvUri() {
  const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
  const m = env.match(/MONGO_URI=mongodb\+srv:\/\/([^@]+)@([^/?]+)(\/[^?]*)\??(.*)/);
  if (!m) return null; // let dotenv's value through unchanged
  const hosts = m[2].split(",").map((h) => h.trim() + ":27017").join(",");
  const opts = (m[4] || "").replace(/&$/, "");
  return "mongodb://" + m[1] + "@" + hosts + (m[3] || "/") + "?" + opts + "&tls=true";
}

function log(msg) {
  const line = `[resilient ${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(path.join(LOG_DIR, "runner.log"), line + "\n"); } catch {}
}

function tryOnce(nonSrvUri, attempt) {
  return new Promise((resolve) => {
    const out = fs.openSync(path.join(LOG_DIR, "backend.log"), "a");
    const err = fs.openSync(path.join(LOG_DIR, "backend.err"), "a");
    const env = { ...process.env, PORT: "5000" };
    if (nonSrvUri) env.MONGO_URI = nonSrvUri;

    log(`attempt ${attempt}: starting server.js...`);
    const child = spawn("node", ["server.js"], { cwd: ROOT, detached: false, stdio: ["ignore", out, err], env });

    let settled = false;
    const tail = fs.openSync(path.join(LOG_DIR, "backend.log"), "r");

    const timer = setInterval(() => {
      try {
        const s = fs.readFileSync(path.join(LOG_DIR, "backend.log"), "utf8");
        const win = s.slice(-4000);
        if (win.includes("MongoDB connected successfully")) {
          settled = true;
          clearInterval(timer);
          log(`attempt ${attempt}: CONNECTED to MongoDB (pid ${child.pid})`);
          child.unref(); // leave it running detached from this watcher
          resolve(true);
        } else if (win.includes("MOCK DB ACTIVATED")) {
          settled = true;
          clearInterval(timer);
          log(`attempt ${attempt}: fell into MOCK mode — killing and retrying`);
          try { process.kill(child.pid); } catch {}
          resolve(false);
        }
      } catch {}
    }, 1000);

    child.on("exit", (code) => {
      if (!settled) {
        settled = true;
        clearInterval(timer);
        log(`attempt ${attempt}: server exited early (code ${code})`);
        resolve(false);
      }
    });

    // Give up watching after 45s regardless
    setTimeout(() => {
      if (!settled) {
        settled = true;
        clearInterval(timer);
        try { process.kill(child.pid); } catch {}
        log(`attempt ${attempt}: timed out waiting for DB verdict`);
        resolve(false);
      }
    }, 45_000);
  });
}

(async () => {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const nonSrvUri = buildNonSrvUri();
  log(nonSrvUri ? "non-SRV URI override ready" : "no SRV URI in .env — using dotenv value");

  for (let i = 1; i <= MAX_TRIES; i++) {
    const ok = await tryOnce(nonSrvUri, i);
    if (ok) {
      log("backend is live with real MongoDB — done");
      process.exit(0);
    }
    if (i < MAX_TRIES) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  }
  log("GAVE UP: MongoDB never connected. Check network/DNS and the Atlas IP whitelist (current public IP must be allowed).");
  process.exit(1);
})();
