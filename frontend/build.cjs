const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const rootNextDir = path.join(rootDir, '.next');
const targetNextDir = path.join(__dirname, '.next');

console.log('🚀 Running HomeLink build pipeline for Vercel...');

// 1. Ensure root dependencies are installed
if (!fs.existsSync(path.join(rootDir, 'node_modules', 'next'))) {
  console.log('📦 Installing root project dependencies...');
  execSync('npm install', { cwd: rootDir, stdio: 'inherit' });
}

// 2. Build the Next.js application at root
console.log('⚡ Building Next.js production bundle at repository root...');
execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

// 3. Ensure frontend/.next is populated with the complete Next.js build
if (fs.existsSync(rootNextDir)) {
  console.log('📋 Syncing .next output to frontend/.next...');
  fs.cpSync(rootNextDir, targetNextDir, { recursive: true, force: true });
}

console.log('✅ HomeLink production build complete and ready for deployment.');

