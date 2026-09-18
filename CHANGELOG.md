
## V64.2 — Screenshot-Grounded Geometry + Seamless Surfaces (2026-09-18)

- Audited the supplied screenshot capture set and current V64.1 source before changing layout rules.
- Corrected Tenant User fixed-rail/main geometry so content starts immediately after the rail instead of leaving a large empty gutter.
- Removed the boxed welcome treatment from Tenant User and made the Guardian/Sanctum strip a seamless composition.
- Increased the compact Guardian stage and inset the top/bottom relationship nodes so all six nodes remain visible.
- Corrected light-theme sign-out/sidebar-bottom treatment so no dark/gradient slab remains behind Sign out.
- Made the public Guardian Gate a section-level composition instead of a large rectangular card.
- Added explicit 04 Context dimensions and safe node positions to prevent clipping.
- Added a final interactive-control contract: action buttons are solid ARKA blue and sign-out/theme controls are transparent; decorative gradients remain available for non-interactive visuals.
- Added V64.2 Playwright geometry and visual-contract tests for Tenant User alignment, seamless surfaces, Guardian node containment, light sign-out, and Guardian Gate treatment.
- Preserved Supabase, authentication, RBAC, onboarding, routing, tenant data, and application behavior.

## V63.0 — Screenshot-Driven Visual Consistency Pass (2026-09-18)

- Reviewed the complete `arka-screenshots32tests` capture set: public desktop/mobile, public light desktop/mobile, login, Super Admin, Tenant Admin and Tenant User captures, including after-scroll states and diagnostic/button inventories.
- Corrected Tenant User light mode, whose actual root is `.workspace-page` and was therefore bypassing the `.workspace-shell` light-theme rules.
- Removed the green/cream cast from active light surfaces and standardized them to the ARKA blue-white palette.
- Removed gradient fills from interactive primary/action controls across public, login, Tenant Admin, Tenant User, Super Admin and onboarding surfaces.
- Made Sign out controls transparent in light mode so they no longer appear as dark gradient cards.
- Made theme toggles borderless and embedded in the surrounding header/sidebar rather than card-like controls.
- Corrected the public Principle display word so `CONTEXT` remains inside the section on desktop and mobile instead of being clipped to `CONTE`.
- Added Playwright visual-contract assertions for light root surfaces, sign-out treatment, interactive button gradients and Principle geometry.
- Preserved authentication, Supabase, RBAC, routing and data behavior.

### V63.0 QA interpretation
The screenshot set is now treated as visual evidence. Route existence, accessibility and runtime checks are retained, but the suite also checks the visual contracts that the earlier tests could not detect: theme continuity, control treatment and clipping/geometry.
## V62.5 — Source-Aligned CSS Audit & Blue Surface Cleanup (2026-09-18)

- Audited the complete `src/styles.css` against the rendered class names found across `src/**/*.tsx`, `src/**/*.ts`, `src/**/*.jsx`, and `src/**/*.js`.
- Normalized remaining legacy green/copper/warm command-deck surface colors into the ARKA blue/indigo/cyan system instead of relying only on later override blocks.
- Added a centralized Super Admin surface contract covering panels, cards, health surfaces, registry footprint, forms, modals, navigation, status controls, and light mode.
- Fixed the Super Admin **System Health → Current registry footprint** surface that still had a hard-coded green background.
- Fixed the V62.4 cellular core interaction by restoring `pointer-events:auto` on the draggable core; the field remains `touch-action:pan-y` so mobile page scrolling is not hijacked by the first swipe.
- Removed excessive stylesheet blank-line noise without altering CSS rule content/ordering.
- Added `scripts/audit-css.mjs` so future iterations can repeat the source-to-CSS audit instead of guessing which styles are active.
- Preserved Supabase/auth/RBAC/onboarding/application behavior and did not modify Supabase configuration or migration files.

### Verification
- CSS parsed successfully with `tinycss2` after the cleanup: 0 parse errors.
- Static audit scanned all 4,490 CSS lines against 16 source files / 478 discovered class tokens: 1,964 selector fragments, 546 repeated selector fragments, 0 potential orphan selector fragments, and 0 legacy green/copper token hits. Repeated selectors are retained where cascade/theme/media behavior may be intentional; they are now measurable by the audit script rather than guessed away.
- Full TypeScript build was attempted, but this clean ZIP intentionally contains no `node_modules`; the available global TypeScript compiler therefore reports missing project dependencies (`react`, `react-router-dom`, `lucide-react`, `motion`, etc.). No dependency install was performed because the environment has no reliable package-network access.

# V61.9 — CSS / Runtime Cleanup and Control-Plane Alignment

## V64.3 — Visual Recomposition + Screenshot Matrix QA (2026-09-18)

- Reworked protected-shell geometry so the fixed navigation rail and main canvas share one explicit coordinate system.
- Removed the nested-card treatment from the Tenant User welcome and Guardian visualization; the content now sits directly on the page canvas.
- Increased product surface radii and softened card separation across Tenant User, Tenant Admin and Super Admin.
- Expanded the compact Guardian stage and strengthened all six relationship nodes so the full context map remains visible inside the visualization.
- Corrected the Super Admin header title contrast so `Dashboard` and section headings remain visible in dark mode.
- Kept light mode on the same geometry and component structure while using blue-white surfaces instead of dark islands.
- Added a dedicated screenshot-matrix QA pass that captures every public/protected route across desktop, mobile, light, and post-scroll states, with screenshots written even when a later assertion fails.
- Preserved Supabase, authentication, RBAC, onboarding, routing and data behavior.

### Visual acceptance targets
- Main content begins immediately after the fixed rail with a small, intentional canvas inset.
- No large centered gutter inside protected shells.
- Guardian visualization is an embedded system field rather than a card nested inside another card.
- Product cards use rounded geometry and soft boundaries rather than square slabs.


- Cleaned superseded CSS selectors and unused custom-property declarations from `src/styles.css` using a source-aware selector pass (7,299 → 5777 lines).
- Removed unreferenced legacy components and duplicate Supabase client module.
- Removed unreferenced legacy logo assets and generated TypeScript build metadata.
- Preserved all active auth, routing, Supabase, RBAC, onboarding, Tenant Admin, Super Admin, and workspace code.
- Reduced Super Admin desktop content padding so the control plane sits closer to the fixed navigation rail at 100% zoom.
- Added `CLEANUP-REPORT.md` documenting the removals and validation approach.

# ARKA V61 — Blue Gradient + Pixel Cellular System

Date: 2026-09-17

V61 continues V60.1 rather than redesigning ARKA from scratch. The implementation preserves the existing Supabase/authentication, routing, tenant onboarding, RBAC, Tenant Admin, Super Admin and platform-control functionality while applying the final visual-system and entrance-interaction pass.

## What changed

- Replaced the first-load conventional drag slider with a pointer/touch-driven cellular security-field interaction.
- Added a draggable ARKA security core that moves freely through the field instead of along a slider track.
- Cellular nodes now react to the core position, creating local displacement, scaling and energy effects.
- Added field-energy/readout feedback and a natural completion transition.
- Kept an accessible non-drag entry action.
- Introduced centralized ARKA V61 blue-system design tokens for dark and light themes.
- Normalized the active public V60/V60.1 editorial surfaces to deep navy, blue, cool cyan and restrained indigo.
- Removed the active green/copper visual treatment from the public flow, Guardian/Login gate, Tenant Admin and Super Admin presentation layers.
- Preserved semantic error styling rather than converting error states into decorative blue.
- Updated light-theme surfaces, controls, active states, focus states, panels and navigation for blue-system contrast.
- Converted Tenant Admin to a fixed control-plane sidebar with an independently scrolling main content area.
- Converted Super Admin to the same fixed-sidebar / independently-scrolling-main behavior.
- Kept navigation internally scrollable and the status/sign-out footer pinned at the bottom of both admin sidebars.
- Added V61 CSS compatibility bridges for the older Digital Temple components so legacy component structure does not reintroduce the former palette.
- Updated the Login page's animated core highlight from neon green to the ARKA blue/cyan system.

## Modified files

- `src/components/DragGate.tsx`
- `src/pages/Login.tsx`
- `src/styles.css`
- `CHANGELOG.md`

## Pixel / cellular entrance

The entrance no longer has a track, progress bar, or conventional slider handle. The user grabs the central ARKA security core and moves it anywhere inside a large cellular field. The field calculates the core's relationship to each node and applies displacement, scale and opacity changes around the moving point. A threshold based on movement distance completes the handshake and fades into the public ARKA experience. Pointer events support mouse, pen and touch input.

## Theme system

V61 adds reusable `--arka-*` tokens and maps the active V60.1 public, Tenant Admin and Super Admin layers to the same blue system. Dark mode uses navy/blue/cyan/indigo; light mode uses blue-white surfaces with dark blue typography and restrained blue accents. The legacy green/copper styles remain only as historical/compatibility rules in the large stylesheet; V61 overrides the active components so those palettes are not the rendered design system.

## Validation

- Filesystem/runtime environment check: passed.
- CSS structural brace check: passed (`6449` opening and `6449` closing braces after V61 changes).
- TypeScript project check was attempted with the globally available `tsc`.
- Full dependency installation could not complete in the execution environment: npm timed out while attempting to install packages, and offline installation reported the required packages were not cached.
- Consequently a full Vite production build could not be completed here. The TypeScript output was dominated by missing dependency/type declarations (`react`, `react-router-dom`, `lucide-react`, `motion/react`, etc.), not by a completed dependency-aware build.

## V61.1 — Blue System Correction Pass (2026-09-17)

- Corrected remaining green/copper visual overrides visible in the V60.1/V61 public Context section.
- Normalized the 04 — CONTEXT relationship canvas, nodes, routes, core, grid and scan effects to the ARKA blue system.
- Reworked remaining public Method, Surfaces, Trace, Guardian Gate and contact/footer accents to blue/cyan/indigo.
- Replaced remaining Tenant Admin V47 sage/copper backgrounds, borders, status chips, workspace cards and embedded Temple accents with the blue system.
- Replaced remaining Super Admin V54 sage/copper backgrounds, navigation treatment, control-plane surfaces, status accents and primary controls with the blue system.
- Added explicit fixed-shell scroll contracts for Tenant Admin and Super Admin: sidebar stays fixed, navigation scrolls internally, main content owns the scroll container, and the footer/sign-out region remains pinned.
- Added explicit light-theme overrides for Tenant Admin and Super Admin to prevent legacy green/copper inheritance and improve contrast.
- Kept authentication, Supabase access, RBAC, routing, onboarding and database behavior unchanged.

## V61.2 — Control Plane Palette Lock (2026-09-18)

- Added a final high-specificity visual override layer for the Super Admin and Tenant Admin consoles.
- Neutralized the older V56/V59 sage, copper, graphite and warm-surface compatibility rules that were still winning through higher-specificity selectors.
- Super Admin page background, sidebar, role badge, hero, metric cards, health strip, control surfaces, tables, modals and primary actions now use the ARKA navy/blue/indigo system consistently.
- Tenant Admin welcome, metrics, Guardian/Temple context field, nodes, links and role treatment are locked to the same blue system.
- Light-theme control-plane and tenant surfaces now explicitly prevent legacy green/copper styling from returning.
- No authentication, Supabase, routing, RBAC, onboarding, database, API or business logic was changed.
## V61.3 — User Role Strip Blue Correction

- Fixed the remaining legacy green/warm surfaces in the Super Admin **Users** role summary (`Super Admin`, `Tenant Admin`, `Tenant User`, `Pending`).
- Added high-specificity dark/light overrides for `.admin-role-metric` so these cards use the same ARKA navy/blue/indigo system as the rest of the control plane.
- Updated role pills and access-summary accents to prevent legacy sage/copper styling from returning.
- No authentication, routing, Supabase, RBAC, database, or user-management behavior was changed.


## V61.4 — Context Field Geometry Correction — 2026-09-18

- Corrected the public `04 — CONTEXT` shell geometry so the outer border and inner relationship field share one exact grid.
- Removed the desktop grid gap that made the two context halves appear visually disconnected/misaligned.
- Made the context visual fill its grid cell at a stable 620px desktop height, with responsive reductions at tablet/mobile widths.
- Added safe geometry limits for orbit sizes and relationship nodes so the field does not visually clip against the shell edges.
- Preserved the existing Context surface interaction, relationship switching, animations, routing and public-site functionality.

## V61.5 — Runtime palette normalization / tunnel QA preparation
- Added Vite `server.allowedHosts` support for `.trycloudflare.com` so the development UI can be inspected through a Cloudflare Quick Tunnel.
- Performed a project-wide CSS palette normalization pass over legacy green/phthalo, copper, brown and orange accent literals, moving those visual accents into ARKA's blue/electric-blue/indigo system while preserving semantic error styling.
- Added a final high-specificity V61.5 blue-system lock covering public surfaces, Context/relationship visuals, login, Tenant workspace, Super Admin V54 legacy selectors, role metrics/pills, tables, forms, modals, status indicators and fixed sidebar/scroll contracts.
- Kept Supabase/auth/RBAC/onboarding/data-flow components untouched by the visual pass.
- Build verification could not be completed in this environment because project dependencies are not installed and `npm install` timed out; the source/config changes were syntax-checked structurally and should be rebuilt in the user's Docker environment.


## V61.6 — Runtime QA correction

Date: 2026-09-18

The first local Playwright runtime pass successfully loaded all five requested paths, but the protected `/admin`, `/tenant`, and `/app` paths resolved to the Login surface because the QA environment did not establish an authenticated Supabase role session. Those routes therefore must not be considered authenticated admin/workspace visual validation.

### Corrective source changes

- Fixed the Login header branding markup so the `Brand` component is not nested inside a second React Router `<Link>`. This removes the invalid `<a>` inside `<a>` hydration warning observed in the Playwright diagnostics.
- Extended `Brand` with an optional `className` prop so page-specific styling can be applied without wrapping the component in another link.
- Normalized remaining public-flow warm/copper RGB accents to the blue/indigo system.
- Renamed the public-flow `--af-green` / `--af-warm` semantic variables to `--af-accent` / `--af-indigo` to remove misleading legacy palette terminology while retaining the intended blue visual values.

### QA interpretation

The supplied Playwright report recorded 5/5 test cases as passed, with no failed network requests or page-level errors, but the protected-route screenshots were Login screenshots rather than authenticated Super Admin, Tenant Admin, and Workspace screens. A future authenticated QA run should establish a real Supabase session and assert route identity before evaluating those surfaces.

## V61.7 — Authenticated Playwright QA hardening

- Added a corrected Playwright configuration at `e2e/playwright.config.ts` with the test directory resolved relative to the config file and Microsoft Edge support.
- Replaced the previous protected-route false-positive QA behavior with authenticated role tests for Super Admin, Tenant Admin, and Tenant User.
- Protected routes now explicitly fail QA if they redirect to `/login`.
- Added role-specific UI markers so each protected surface must actually render before the test passes.
- Added runtime checks for page errors, failed requests, nested anchor markup, horizontal overflow, and known legacy green/neon palette values.
- Added desktop/mobile-capable screenshot capture and JSON diagnostics.
- Credentials are read only from PowerShell environment variables; they are not stored in source, screenshots, reports, or the project archive.

## V61.7 — Control Plane Density / Desktop Scale
- Increased Super Admin and Tenant Admin desktop shell scale so the product is readable at 100% browser zoom.
- Expanded desktop control-plane sidebars while preserving fixed-shell scrolling behavior.
- Increased navigation, table, status, toolbar, metric, card, heading and form-control typography/spacing.
- Increased usable content width and reduced the visual impression of an underscaled control plane.
- Added responsive breakpoints so the density pass does not compromise mobile layouts.
- Extended Playwright diagnostics with a density contract for authenticated admin surfaces.


## V61.8 — Control-plane alignment + Playwright Edge runner

- Reduced the desktop Super Admin/Tenant Admin main-content gutter from 48px to 24px so the control-plane content sits closer to the fixed navigation rail while retaining the larger readable scale introduced in V61.7.
- Reduced the intermediate desktop gutter to 22px for tighter alignment at widths up to 1100px.
- Updated `e2e/playwright.config.ts` to run the Chromium Playwright driver through the installed Microsoft Edge channel (`msedge`) by default instead of relying on Playwright's downloaded Chromium/headless-shell binary.
- Added `PLAYWRIGHT_BROWSER_CHANNEL=chrome` as an optional override for machines that have Google Chrome installed.
- Kept the existing test routes, authentication checks, screenshots, diagnostics, and runtime assertions unchanged.

## V62.3 — Generic Codebase Naming & Standalone Iteration
**2026-09-18**

- Established semantic, non-iteration-specific naming for the active UI code.
- Replaced `admin54-*`/`admin-v48`/`admin-v54` naming with generic `admin-*`/`admin-shell`.
- Separated the Tenant workspace page root from Super Admin workspace inventory records using `workspace-page` and `workspace-record`.
- Replaced targeted V47-specific active class names with semantic equivalents.
- Updated the Playwright QA suite to use the new naming.
- Added `scripts/verify-architecture.mjs` to catch reintroduction of targeted legacy naming.
- Added `ARCHITECTURE-CLEANUP.md` with the permanent naming/cleanup rules.
- Added `IMPORT-AND-RUN.md` so this ZIP can be extracted and run as a standalone iteration without copying patches into an older project.
- Added `npm run verify:architecture` as the repeatable naming/stylesheet sanity check.
- Preserved `.env*` files and all `supabase/` files unchanged.
- Preserved authentication, RBAC, onboarding, routing, database operations and existing application behavior.
## V62.4 — Mobile Entrance + Element-Level Regression QA (2026-09-18)

- Changed the public cellular entrance so **only the draggable core starts a drag**; the field itself no longer captures every pointer-down.
- Added touch-safe behavior: the field permits normal vertical page scrolling on mobile while the core uses `touch-action: none` for intentional drag gestures.
- Added keyboard activation to the cellular core (`Enter` / `Space`) while retaining the explicit “Enter ARKA without interaction” path.
- Added element-level Playwright coverage for public controls, navigation targets, cellular-field composition, context transitions, login controls, protected shells, theme controls, mobile overflow, Tenant Admin onboarding, and Super Admin modules.
- Preserved `.env`, Supabase configuration, authentication, RBAC, routing, and application data behavior.

### QA intent
This iteration deliberately tests individual UI surfaces rather than treating a route-level screenshot/pass as proof that every interaction works.


## V62.6 — Principle Grid / Typography Integrity (2026-09-18)

- Fixed the public **06 — PRINCIPLE** layout where the oversized `CONTEXT` display word could force the right-hand copy grid track to shrink below its intended width.
- Changed the principle grid tracks to `minmax(0, ...)` and explicitly allowed the grid/copy wrappers to shrink without overflowing their parent.
- Preserved the large editorial `CONTEXT` treatment while preventing **“See the relationship.”** from being clipped at the right edge.
- Added responsive grid rules so the principle section becomes a single-column layout below the desktop breakpoint.
- No routing, authentication, Supabase, RBAC, tenant, or Super Admin functionality was changed.

### Visual issue diagnosed
The clipping visible in the supplied screenshot was caused by CSS grid intrinsic sizing: the large `CONTEXT` word established an oversized minimum-content width for the first grid track, squeezing the second track. The section itself also had `overflow:hidden`, so the final characters were clipped rather than wrapping into available space.

## V62.7 — Screenshot-Driven UI + Playwright Reliability Cleanup (2026-09-18)

- Analyzed the supplied `arka-screenshots` capture set instead of treating the latest Principle screenshot in isolation.
- Corrected Playwright's public element tests so the intentional cellular entrance gate is dismissed before interacting with content behind it.
- Added a public-page reveal pass before full-page captures so IntersectionObserver-driven sections are actually represented in screenshots instead of appearing as blank bands.
- Corrected protected-surface selectors: `.admin-nav-main` is itself the navigation button, and Tenant Admin uses `.workspace.workspace-shell` rather than `.workspace-page`.
- Strengthened authenticated QA so a login/access-resolution failure cannot be silently treated as a successful protected-route capture.
- Added an accessible label to the Super Admin mobile navigation control.
- Removed empty historical media-query blocks from the stylesheet.
- Scrubbed remaining historical warm/green palette literals from the legacy protected-surface region and kept the V61+ blue token layer authoritative.
- Replaced rendered `copper` / `ivory` Temple node tone names with generic `accent` / `soft` names and blue styling.
- Preserved Supabase, authentication, RBAC, routing, tenant onboarding, registry, and application behavior.

## V62.8 — Landing Transition + Tenant Shell Repair + Playwright Fixes (2026-09-18)

- Removed the blocking first-load cellular **drag-to-enter** experience from the public landing page.
- Removed `src/components/DragGate.tsx` and its obsolete cellular/drag CSS.
- Added a non-blocking cinematic landing boot transition that runs automatically and never captures pointer input.
- Repaired Tenant Admin shell geometry by aligning the component root with the existing workspace-page contract and removing the legacy double-sidebar-offset behavior.
- Normalized the Tenant Admin enhanced selectors to target the actual `.workspace-shell` root.
- Preserved fixed desktop sidebar / independently scrolling main content and mobile drawer behavior.
- Fixed the Playwright `ReferenceError: window is not defined` by reading viewport height inside `page.evaluate()`.
- Replaced obsolete cellular-field Playwright assertions with regression coverage for the new landing transition and the absence of the old blocking gate.
- Kept the public surface, context, login, authentication, Supabase, RBAC, onboarding, and protected route tests intact.
- Re-ran the CSS cleanup after removing the old gate: 0 obsolete drag/cellular selector references and balanced CSS braces.

## V62.9 — Light Public Surface Continuity + QA Hardening (2026-09-18)

- Reworked public light theme so Context, Guardian Gate and Contact no longer render as dark blue islands on a pale page.
- Removed the heavy outer treatment from the light Context shell while retaining a restrained framed visualization.
- Converted Guardian Gate to a light editorial panel with blue grid detail and readable dark typography.
- Converted Contact footer to the same light surface family.
- Simplified the public theme toggle into an embedded circular control instead of a square boxed control.
- Added explicit Playwright light-theme coverage for public surface continuity and theme-toggle geometry.
- Corrected Tenant Admin visual QA so it validates actual heading geometry/readability rather than incorrectly requiring the heading color to differ from its inherited parent color.

### V62.9 QA capture expansion
- Public and authenticated Playwright screenshot flows now explicitly capture light desktop/mobile variants so light-mode regressions cannot remain invisible behind the default dark-mode capture.
- Theme-control styling is now consistent across public and protected shells and is intentionally not rendered as a boxed card.


## V62.9 — Shell Geometry Finalization

- Finalized Tenant Admin geometry as one fixed sidebar + one independently scrolling main coordinate system.
- Removed the competing flex/fixed positioning combination that could produce misleading full-page captures with large blank vertical regions.
- Kept mobile drawer behavior separate from desktop geometry.
- Added light-shell surface continuity for the protected workspace.


## V62.9 — User Screenshot Deep Review

- Reviewed the three newly supplied light-theme screenshots as a user would see them rather than limiting QA to selector existence.
- Fixed the clipped `NOW` context node by giving every relationship node an explicit position inside the graph.
- Finalized protected Tenant Admin shell geometry as fixed rail + scrolling main.

## V64.1 — Screenshot Audit Correction + Cross-Shell Visual Contracts (2026-09-18)

- Re-reviewed the supplied user screenshots at component level rather than relying on route-level pass/fail results.
- Corrected the Tenant User desktop coordinate system: the fixed 248px rail no longer leaves the main workspace visually displaced; the main column and content now begin on the rail's actual right edge.
- Removed remaining green/olive/warm visual leakage from Tenant User, Tenant Admin, Super Admin and the embedded Guardian/Temple visualization.
- Reworked dark protected surfaces to the same ARKA navy / blue / cyan system instead of the inherited green/olive command-deck palette.
- Reworked light protected surfaces so the page is a continuous blue-white canvas; sign-out controls are transparent/embedded rather than dark or gradient blocks.
- Reworked public light Context, Guardian Gate and Contact so they do not appear as dark blue islands inside the light page.
- Reworked public dark Context, Guardian Gate and Contact to stay blue rather than inheriting green/olive tones.
- Made primary interactive controls solid ARKA blue with no gradient fills across public, login, Tenant User, Tenant Admin and Super Admin surfaces.
- Kept decorative gradients available for non-interactive visual effects; they are not used as action-button fills.
- Moved the top Context relationship node farther inside the visualization so it cannot touch or clip against the upper edge.
- Added Playwright contracts for screenshot-specific surface continuity, protected-shell geometry, green/olive leakage, solid action controls, and Context-node containment.
- Preserved Supabase, authentication, RBAC, tenant onboarding, routing, database operations, and existing functional workflows.


## V64.4 — Organic System Recomposition (2026-09-18)

- Replaced the Tenant User `ARKA / SANCTUM` workspace treatment with a new `WorkspaceContext` system-context composition. The authenticated workspace no longer uses the temple/sanctum visual language.
- Reworked the Tenant User overview into a rounded control-plane surface with an interactive context map, circular core, connected layers, and rounded navigation nodes.
- Reworked the public live-context visual so it is an orbital composition rather than a rectangular card.
- Reworked the public Context section to use an open, rounded visual island instead of a boxed panel.
- Reworked Guardian Gate into an organic rounded field with orbital geometry rather than a rectangular box.
- Kept existing routing, Supabase authentication, RBAC, tenant onboarding, applications, settings, audit, and admin functionality intact.
- Added responsive/light-theme variants for the new geometry.
- Updated the project version to `0.1.0-v64.4`.
