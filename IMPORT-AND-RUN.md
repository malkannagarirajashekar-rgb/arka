# ARKA V62.3 — Import and Run

This ZIP is a complete standalone iteration. Do not copy files into an older ARKA folder.

## 1. Extract
Extract the ZIP into a fresh project directory, for example:

```powershell
C:\Project\Arka-v62.3
```

## 2. Keep environment and Supabase configuration
Do not modify your existing `.env` values or Supabase SQL/functions for this UI/codebase iteration.

If your local setup already has the required `.env`, keep those values in the extracted project.

## 3. Install dependencies

```powershell
npm install
npx playwright install chromium
```

## 4. Architecture check

```powershell
npm run verify:architecture
```

This checks that targeted iteration-specific class names have not returned and that the stylesheet has no empty top-level CSS blocks.

## 5. Build

```powershell
npm run build
```

## 6. Run the app

```powershell
npm run dev -- --host 0.0.0.0
```

## 7. Run visual/runtime QA

Set the same E2E credentials you already use in your PowerShell session, then:

```powershell
npx playwright test arka-visual-qa.spec.ts --config=e2e/playwright.config.ts
```

The project already contains the Playwright configuration and QA suite.

## Important

Each future ARKA iteration will be delivered as a full standalone project ZIP based on the latest verified iteration. You should extract the new ZIP and work from that copy; you should not copy individual CSS/TSX snippets into an older version.
