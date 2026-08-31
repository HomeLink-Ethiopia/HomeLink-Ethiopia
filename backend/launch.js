const { spawn } = require('child_process');
const path = require('path');

const logFile = path.join(__dirname, '..', '.freebuff', 'backend.log');
const errFile = path.join(__dirname, '..', '.freebuff', 'backend.err.log');

const child = spawn('node', ['server.js'], {
  cwd: __dirname,
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true,
});

const fs = require('fs');
const outStream = fs.createWriteStream(logFile, { flags: 'a' });
const errStream = fs.createWriteStream(errFile, { flags: 'a' });

child.stdout.pipe(outStream);
child.stderr.pipe(errStream);

console.log('Backend PID:', child.pid);
child.unref();
