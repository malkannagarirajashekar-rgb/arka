# ARKA authenticated visual QA

The suite tests the public landing/login surfaces and the three authenticated role surfaces.

## Required environment variables

Set these only in the PowerShell session used for QA. Use dedicated test accounts.

```powershell
$env:ARKA_E2E_SUPER_ADMIN_EMAIL="..."
$env:ARKA_E2E_SUPER_ADMIN_PASSWORD="..."
$env:ARKA_E2E_TENANT_ADMIN_EMAIL="..."
$env:ARKA_E2E_TENANT_ADMIN_PASSWORD="..."
$env:ARKA_E2E_TENANT_USER_EMAIL="..."
$env:ARKA_E2E_TENANT_USER_PASSWORD="..."
```

`BASE_URL` defaults to `http://localhost:5173`. `PLAYWRIGHT_EXECUTABLE_PATH` defaults to the standard 64-bit Edge path used by the project machine.

## Run

```powershell
npx playwright test arka-visual-qa.spec.ts --config=e2e/playwright.config.ts
```

A protected-role test **fails** if authentication lands on `/login`, if the expected role surface is missing, if there are page errors/failed requests, if nested anchors exist, if known legacy green/neon colors are detected, or if horizontal overflow is present.

Screenshots and JSON diagnostics are written to `playwright-report/arka-screenshots/`.
