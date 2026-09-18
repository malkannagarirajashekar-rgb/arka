import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const cssPath = path.join(root, 'src', 'styles.css');
const css = fs.readFileSync(cssPath, 'utf8');
const sourceFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'playwright-report', 'test-results'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(tsx?|jsx?|html)$/.test(entry.name)) sourceFiles.push(full);
  }
}
walk(path.join(root, 'src'));
const source = sourceFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const sourceClasses = new Set(['brand']);
for (const match of source.matchAll(/className\s*=\s*(?:[\"'`]([^\"'`]+)[\"'`]|\{`([^`]*)`\})/g)) {
  const value = match[1] ?? match[2] ?? '';
  for (const c of value.matchAll(/[A-Za-z_][\w-]*/g)) sourceClasses.add(c[0]);
}
for (const match of source.matchAll(/className\s*=\s*[\"'`]([^\"'`]+)[\"'`]/g)) {
  for (const c of match[1].matchAll(/[A-Za-z_][\w-]*/g)) sourceClasses.add(c[0]);
}
for (const match of source.matchAll(/["']([A-Za-z_][\w-]*)["']/g)) {
  const c = match[1];
  if (c.includes('-') || ['active','selected','open','compact','good','online','offline','danger','wide','users','org'].includes(c)) sourceClasses.add(c);
}

const lines = css.split(/\r?\n/);
const legacy = ['#101611','#0c120f','#080d0b','#111712','#0d120f','#121913','#171914','#151715','#1b1a18','#151513','#211d19','#0b0f0c','#151b16','#eef0e9','#e8ebe3','#435f8f','#a66f51','#e6d8c2','#f0ece3','#f3ede3','#a96f55','rgba(229,216,191','rgba(118,55,48','rgba(164,104,79','rgba(169,111,85','rgba(185,120,93','rgba(143,79,67','rgba(58,57,76','rgba(54,52,82','rgba(166,104,79','#b97862','#c4876c','#b56a54','#d644c3','#b35df4','#cf4ed2'];
const legacyHits = [];
for (const [i, line] of lines.entries()) {
  if (legacy.some((token) => line.toLowerCase().includes(token.toLowerCase()))) legacyHits.push(i + 1);
}
const selectorCounts = new Map();
for (const match of css.matchAll(/([^{}]+)\{/g)) {
  const prelude = match[1].trim();
  if (!prelude || prelude.startsWith('@') || prelude.startsWith('/*')) continue;
  for (const selector of prelude.split(',').map((x) => x.trim()).filter(Boolean)) {
    if (/^(from|to|\d+%)$/.test(selector)) continue;
    selectorCounts.set(selector, (selectorCounts.get(selector) ?? 0) + 1);
  }
}
const duplicates = [...selectorCounts.entries()].filter(([, n]) => n > 1).sort((a,b) => b[1]-a[1]);
const potentialOrphans = [...selectorCounts.keys()].filter((selector) => {
  const classes = [...selector.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]);
  return classes.length > 0 && classes.every((c) => !sourceClasses.has(c));
});

console.log(JSON.stringify({
  cssLines: lines.length,
  sourceFiles: sourceFiles.length,
  sourceClassTokens: sourceClasses.size,
  selectorFragments: selectorCounts.size,
  duplicateSelectorFragments: duplicates.length,
  potentialOrphanSelectorFragments: potentialOrphans.length,
  legacyColorHits: legacyHits.length,
  legacyColorLines: legacyHits,
  legacyToneSourceTokens: [...source.matchAll(/\b(?:copper|ivory|sage|warm|parchment|umber|terracotta|acid-green|mint|sand|rust)\b/gi)].map(m => m[0]).filter((v,i,a)=>a.indexOf(v)===i),
}, null, 2));
