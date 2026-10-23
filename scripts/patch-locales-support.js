const fs = require('fs');

// Add sidebar.supportRequests to en + am locales
for (const [file, label] of [['locales/en.json', 'Support Requests'], ['locales/am.json', 'የድጋፍ ጥያቄዎች']]) {
  let s = fs.readFileSync(file, 'utf8');
  if (s.includes('"supportRequests"')) { console.log(file, 'already has supportRequests'); continue; }
  const anchor = s.match(/(\s*)"auditLogs":\s*"[^"]*",/);
  if (!anchor) throw new Error('anchor not found in ' + file);
  s = s.replace(anchor[0], anchor[0] + `\n${anchor[1]}"supportRequests": "${label}",`);
  fs.writeFileSync(file, s);
  console.log(file, 'patched');
}

// Add auto-translate entries for the new hardcoded UI strings
let at = fs.readFileSync('lib/auto-translate.tsx', 'utf8');
const additions = [
  ["'No support messages yet'", "'እስካሁን የድጋፍ መልእክቶች የሉም'"],
  ["'Messages submitted from the public support form will appear here.'", "'ከይፋዊ የድጋፍ ቅጽ የተላኩ መልእክቶች እዚህ ይታያሉ።'"],
  ["'In Progress'", "'በሂደት ላይ'"],
  ["'Resolve'", "'መፍትሄ'"],
];
let added = 0;
for (const [en, am] of additions) {
  const key = en.slice(1, -1);
  if (at.includes(en + ':')) continue;
  const anchor = at.indexOf("'Still have questions?':");
  if (anchor === -1) throw new Error('auto-translate anchor not found');
  const lineEnd = at.indexOf('\n', anchor);
  at = at.slice(0, lineEnd + 1) + `  ${en}: ${am}, // sprint-support-inbox\n` + at.slice(lineEnd + 1);
  added++;
}
fs.writeFileSync('lib/auto-translate.tsx', at);
console.log('auto-translate additions:', added);
