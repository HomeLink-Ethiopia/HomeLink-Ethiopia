const fs = require('fs');
const path = require('path');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const files = [...walk('app'), ...walk('components')];
const counts = new Map();

const add = (s) => {
  const t = s.trim().replace(/\s+/g, ' ');
  if (t.length < 2 || t.length > 60) return;
  if (!/[a-zA-Z]{2}/.test(t)) return; // must contain letters
  if (/^[^a-zA-Z]*$/.test(t)) return;
  counts.set(t, (counts.get(t) || 0) + 1);
};

for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  // JSX text nodes: >Text Here<
  for (const m of c.matchAll(/>\s*([^<>{}\n][^<>{}\n]*?)\s*</g)) add(m[1]);
  // string literals in common props/labels
  for (const m of c.matchAll(/(?:label|title|placeholder|subtitle|description|buttonText|aria-label|alt)=["'{]([^"'}]+)/g)) add(m[1]);
}

const sorted = [...counts.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]);
console.log('TOTAL unique (freq>=2):', sorted.length);
sorted.slice(0, 250).forEach(([s, n]) => console.log(String(n).padStart(3), '|', s));
