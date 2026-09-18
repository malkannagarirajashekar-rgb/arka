import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const ignoredDirs = new Set(["node_modules", "dist", ".git", "test-results", "playwright-report", "supabase"]);
const textExt = new Set([".ts", ".tsx", ".css"]);

const forbiddenPatterns = [
  /\badmin54-/g,
  /\badmin-v(?:48|54)\b/g,
  /\bworkspace-v47\b/g,
  /\bcontext-panel-v47\b/g,
  /\bv47-(?:context-state|live-chip|live-label|panel-sub|section-bar|stack-strip|welcome-meta)\b/g,
  /\btenant-admin-temple-v47\b/g,
  /\b(?:welcome-summary-v47|workspace-command-v47|workspace-grid-v47|workspace-metric-v47|workspace-stats-v47|workspace-welcome-v47)\b/g,
];

const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (textExt.has(path.extname(entry.name))) files.push(full);
  }
}
walk(root);

const violations = [];
for (const file of files) {
  if (path.basename(file).startsWith(".env")) continue;
  const text = fs.readFileSync(file, "utf8");
  for (const pattern of forbiddenPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) violations.push(path.relative(root, file));
  }
}

const css = fs.readFileSync(path.join(root, "src", "styles.css"), "utf8");
const cssBlocks = [...css.matchAll(/(^|})\s*([^@{}]+)\{([^{}]*)\}/g)];
const emptyBlocks = cssBlocks.filter(([, , selector, body]) => !body.trim() && selector.trim()).length;

console.log(`Architecture check: ${files.length} text files scanned`);
console.log(`Legacy iteration-specific naming violations: ${violations.length}`);
console.log(`Empty top-level CSS blocks detected: ${emptyBlocks}`);

if (violations.length) {
  for (const file of [...new Set(violations)]) console.error(` - ${file}`);
  process.exit(1);
}

console.log("PASS: no targeted legacy iteration-specific class names remain.");
