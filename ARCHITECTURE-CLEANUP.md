# ARKA Codebase Architecture — V62.3

## Purpose
V62.3 establishes a clean naming convention for ongoing ARKA work. New UI work should use semantic component names rather than iteration-specific names.

## Naming rules
- Use semantic names: `sidebar`, `page-shell`, `panel`, `table`, `workspace-page`, `workspace-record`, `admin-shell`.
- Do not introduce versioned selectors such as `admin54-*`, `workspace-v47`, `admin-v54`, or similar iteration markers.
- Prefer one base class plus a meaningful state/modifier class when needed.
- Keep design tokens centralized in `src/styles.css`.
- Do not duplicate an entire component style just to change one visual state.

## Protected areas
This iteration does not modify:
- `.env` / environment secret files
- `supabase/` SQL migrations, functions, or verification scripts
- authentication and database behavior

## Cleanup policy
CSS is removed only when its usage is demonstrably obsolete or when it is an exact duplicate/no-op. Dynamic class names and responsive/theme selectors are retained unless verified safe to remove.

## Validation
Run:

```powershell
npm run verify:architecture
npm run build
npx playwright test arka-visual-qa.spec.ts --config=e2e/playwright.config.ts
```

The Playwright suite remains the runtime/visual gate.
