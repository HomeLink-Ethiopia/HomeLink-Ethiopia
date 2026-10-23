// Sprint 14 — periodic database backups.
//
// MongoDB mode: runs `mongodump` against MONGO_URI into ../backups/mongo-<ts>
// (best-effort; skipped silently when the mongodump CLI is not installed).
// Mock mode: delegates to connectDB.writeMockBackup() JSON snapshots, which
// also run on their own timer from db.js — here we just trigger one more.
//
// Backups are safety-net only; they never block or crash the API on failure.

const { execFile } = require('child_process');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '..', '..', 'backups');
const INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours

function mongodumpBackup() {
  const uri = process.env.MONGO_URI;
  if (!uri || uri.includes('<password>')) return; // not configured
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.join(BACKUP_DIR, 'mongo-' + stamp);
  execFile('mongodump', ['--uri', uri, '--out', out], { timeout: 5 * 60 * 1000 }, (err) => {
    if (err) {
      // mongodump missing or failed — log quietly, never crash.
      console.log('[backup] mongodump skipped:', err.message.split('\n')[0]);
    } else {
      console.log('[backup] mongodump written to', out);
    }
  });
}

function startBackupJob() {
  const db = require('../config/db');
  const run = () => {
    try {
      if (db.isMockMode()) {
        if (typeof db.writeMockBackup === 'function') db.writeMockBackup();
      } else {
        mongodumpBackup();
      }
    } catch (e) { /* never crash on backup */ }
  };
  // First snapshot shortly after boot, then on an interval.
  setTimeout(run, 30 * 1000);
  const timer = setInterval(run, INTERVAL_MS);
  if (typeof timer.unref === 'function') timer.unref();
  console.log('[backup] job started (mock: JSON snapshots, mongo: mongodump)');
}

module.exports = { startBackupJob };
