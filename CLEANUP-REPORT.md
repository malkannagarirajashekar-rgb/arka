# ARKA V62.5 CSS / UI Source Audit

## Scope

This iteration audited the complete source baseline from **Arka V62.4**. The audit covered every line of `src/styles.css` and matched selectors against class names rendered by the current React/TypeScript source under `src/`.

### Source inventory

- CSS: **4,490 lines** after cleanup
- UI source files scanned: **16**
- Discovered source class tokens: **478**
- CSS selector fragments inspected: **1,964**
- Repeated selector fragments: **546**
- Potential orphan selector fragments: **0**
- Previously identified legacy green/copper token hits: **0**
- CSS parser errors: **0**

## What was cleaned

### 1. Super Admin

The old Super Admin palette contained multiple generations of warm graphite/sage/copper declarations. Those declarations could remain in the cascade even after later blue overrides were added. The source-level colors were normalized to the current ARKA blue/indigo/cyan system.

The affected UI includes:

- fixed sidebar and navigation
- role header
- dashboard hero
- metric cards
- platform health strip
- control-surface cards
- organizations / workspaces / users tables
- applications / integrations / agents registry
- access and role surfaces
- configuration forms
- modals and role editor
- system health cards
- audit surfaces
- light-theme equivalents

### 2. System Health registry footprint

The screenshot issue was traced directly to `SystemHealth` in `src/pages/Admin.tsx`. It renders `.admin-health-note` for **Current registry footprint**. The stylesheet contained a hard-coded green surface for this class, so the global palette variables could not affect it.

V62.5 adds `.admin-health-note` to the same centralized Super Admin surface contract and explicitly styles its icon, title, supporting text, border, spacing, dark mode, and light mode.

### 3. Cellular entrance interaction

The V62.4 mobile change made only the cellular core draggable, but the original core rule still had `pointer-events:none`. V62.5 corrects this to `pointer-events:auto` so mouse/touch dragging can actually start from the core. The field itself remains `touch-action:pan-y`, preserving normal vertical page scrolling on mobile.

### 4. Legacy selector cleanup

Verified-dead selector fragments for the former `.admin`, `.sidebar`, `.sign-in`, and `.status-pill` presentation layers were removed where they were not part of the current rendered source. The current audit reports zero selector fragments whose referenced classes are absent from the source inventory.

### 5. Future-proofing

Added `scripts/audit-css.mjs` and the npm script:

```text
npm run audit:css
```

This makes the source-to-CSS audit repeatable on every future iteration. It reports CSS size, source class inventory, selector duplication, potential orphan selectors, and known legacy palette tokens.

## What was deliberately NOT deleted

The 546 repeated selector fragments were **not blindly deleted**. Some are intentionally repeated across:

- dark/light themes
- responsive breakpoints
- component states
- later cascade corrections
- animation/keyframe contexts

Deleting these purely because the selector text appears more than once can change the rendered UI. They are therefore measured and surfaced by the audit script rather than treated as automatically dead code.

## Functional files preserved

Compared with the V62.4 ZIP, the only changed files are:

- `src/styles.css`
- `package.json`
- `CHANGELOG.md`
- `scripts/audit-css.mjs` (new)

The following were verified byte-for-byte unchanged relative to V62.4:

- `supabase/`

No authentication, RBAC, routing, tenant logic, onboarding logic, Supabase migration, or environment configuration was intentionally changed.

## Build limitation

The clean source ZIP does not contain `node_modules`, as expected. The environment has a global TypeScript compiler, but project dependencies are unavailable locally. A TypeScript build was attempted and stopped on missing packages such as `react`, `react-router-dom`, `lucide-react`, and `motion`. CSS parsing itself completed successfully with **0 parse errors**.

## V62.7 follow-up cleanup

The supplied screenshot capture set was reviewed against the source and Playwright suite. The important discrepancies were capture/test issues as well as one previously fixed public layout issue:

- Protected-route screenshot filenames did not guarantee protected shells; several screenshots were actually Login.
- Public full-page captures were taken before all IntersectionObserver reveals had fired.
- Public content tests clicked through the still-visible entrance gate.
- Super Admin navigation tests incorrectly searched for buttons nested inside buttons.
- Tenant Admin tests omitted the actual `.workspace.workspace-shell` root.
- Legacy protected-surface palette literals and rendered Temple tone names were normalized.
- Empty media-query blocks were removed.

The audit script now checks a broader legacy palette set and reports source legacy-tone tokens. Current result: 0 potential orphan selector fragments, 0 legacy palette hits, 0 legacy tone source tokens, and 0 empty top-level CSS blocks.
