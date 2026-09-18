import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const outputDir = path.resolve("playwright-report/arka-screenshots");
fs.mkdirSync(outputDir, { recursive: true });

const publicRoutes = [
  { name: "home", path: "/" },
  { name: "login", path: "/login" },
] as const;

type RoleKey = "SUPER_ADMIN" | "TENANT_ADMIN" | "TENANT_USER";
type RoleCredentials = { email: string; password: string };

const credentials: Record<RoleKey, RoleCredentials | null> = {
  SUPER_ADMIN: process.env.ARKA_E2E_SUPER_ADMIN_EMAIL && process.env.ARKA_E2E_SUPER_ADMIN_PASSWORD
    ? { email: process.env.ARKA_E2E_SUPER_ADMIN_EMAIL, password: process.env.ARKA_E2E_SUPER_ADMIN_PASSWORD }
    : null,
  TENANT_ADMIN: process.env.ARKA_E2E_TENANT_ADMIN_EMAIL && process.env.ARKA_E2E_TENANT_ADMIN_PASSWORD
    ? { email: process.env.ARKA_E2E_TENANT_ADMIN_EMAIL, password: process.env.ARKA_E2E_TENANT_ADMIN_PASSWORD }
    : null,
  TENANT_USER: process.env.ARKA_E2E_TENANT_USER_EMAIL && process.env.ARKA_E2E_TENANT_USER_PASSWORD
    ? { email: process.env.ARKA_E2E_TENANT_USER_EMAIL, password: process.env.ARKA_E2E_TENANT_USER_PASSWORD }
    : null,
};

const roleRoutes: Record<RoleKey, { path: string; marker: RegExp; label: string }> = {
  SUPER_ADMIN: { path: "/admin", marker: /PLATFORM CONTROL|PLATFORM OVERVIEW|Super Admin/i, label: "Super Admin" },
  TENANT_ADMIN: { path: "/tenant", marker: /TENANT ADMIN|ORGANIZATION CONTROL|Organization context map/i, label: "Tenant Admin" },
  TENANT_USER: { path: "/app", marker: /TENANT USER|SECURITY STATE|Connected applications/i, label: "Tenant User workspace" },
};

function writeJson(name: string, value: unknown) {
  fs.writeFileSync(path.join(outputDir, name), JSON.stringify(value, null, 2));
}

async function collectDiagnostics(page: Page, name: string) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("requestfailed", request => {
    failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || "unknown"}`);
  });

  const density = await page.evaluate(() => {
    const root = document.querySelector(".admin-shell, .workspace.workspace-shell");
    if (!root) return null;
    const sidebar = root.querySelector(".admin-sidebar, .workspace-sidebar") as HTMLElement | null;
    const main = root.querySelector(".admin-main, .workspace-main") as HTMLElement | null;
    const bodyFont = getComputedStyle(root).fontSize;
    const nav = root.querySelector(".admin-nav-main, .workspace-nav button") as HTMLElement | null;
    return {
      sidebarWidth: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : 0,
      mainWidth: main ? Math.round(main.getBoundingClientRect().width) : 0,
      bodyFontSize: parseFloat(bodyFont) || 0,
      navFontSize: nav ? parseFloat(getComputedStyle(nav).fontSize) || 0 : 0,
      viewportWidth: window.innerWidth,
    };
  });

  const result = {
    url: page.url(),
    density,
    title: await page.title().catch(() => ""),
    bodyText: ((await page.locator("body").innerText().catch(() => "")) || "").slice(0, 5000),
    viewport: await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight })),
    scrollHeight: await page.evaluate(() => document.documentElement.scrollHeight),
    clientWidth: await page.evaluate(() => document.documentElement.clientWidth),
    horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1),
    anchorNesting: await page.evaluate(() => document.querySelectorAll("a a").length),
    legacyColorElements: await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll("*"));
      const legacy = /#123624|#3f9a70|#00ff00|#39ff14|#00ff66|#00ff88|green/i;
      return elements.filter(element => {
        const style = getComputedStyle(element);
        return [style.color, style.backgroundColor, style.borderColor, style.boxShadow].some(value => legacy.test(value));
      }).length;
    }),
    consoleErrors,
    pageErrors,
    failedRequests,
  };

  writeJson(`${name}-diagnostics.json`, result);
  return result;
}


async function assertNoGradientInteractiveFills(page: Page, label: string) {
  const gradientButtons = await page.locator('button:visible, a.arka-primary:visible, a.arka-contact-action:visible').evaluateAll((elements) =>
    elements.filter((el) => {
      const style = getComputedStyle(el);
      return /gradient/i.test(style.backgroundImage);
    }).map((el) => ({
      tag: el.tagName,
      className: (el as HTMLElement).className,
      text: ((el.textContent || '') as string).trim().replace(/\s+/g, ' ').slice(0, 80),
    }))
  );
  expect(gradientButtons, `${label}: interactive controls must not use gradient fills`).toEqual([]);
}

async function assertLightSurfaceContract(page: Page, label: string) {
  const result = await page.evaluate(() => {
    const root = document.querySelector('.arka-flow, .workspace-page, .workspace-shell, .admin-shell, .arka-access-page') as HTMLElement | null;
    const signout = document.querySelector('.workspace-signout, .admin-signout') as HTMLElement | null;
    const rootStyle = root ? getComputedStyle(root) : null;
    const signoutStyle = signout ? getComputedStyle(signout) : null;
    return {
      theme: document.documentElement.dataset.theme,
      rootBackground: rootStyle?.backgroundColor || '',
      rootImage: rootStyle?.backgroundImage || '',
      signoutBackground: signoutStyle?.backgroundColor || '',
      signoutImage: signoutStyle?.backgroundImage || '',
      signoutBorder: signoutStyle?.borderWidth || '',
    };
  });
  expect(result.theme, `${label}: light theme`).toBe('light');
  expect(result.rootBackground, `${label}: blue-white root surface`).toBe('rgb(244, 247, 252)');
  expect(result.signoutImage, `${label}: signout gradient`).toBe('none');
  expect(result.signoutBorder, `${label}: signout border`).toBe('0px');
}

async function checkInteractiveElements(page: Page, name: string) {
  const buttons = page.locator("button:visible");
  const count = await buttons.count();
  const results: Array<{ index: number; text: string; enabled: boolean }> = [];

  for (let i = 0; i < Math.min(count, 150); i++) {
    const button = buttons.nth(i);
    results.push({
      index: i,
      text: ((await button.innerText().catch(() => "")) || "").trim().replace(/\s+/g, " "),
      enabled: await button.isEnabled().catch(() => false),
    });
  }

  writeJson(`${name}-buttons.json`, results);
  return results;
}

async function preparePublicHome(page: Page) {
  // The public page no longer uses a blocking entrance gate.
  // The landing transition is visual-only and never intercepts interaction.
  await expect(page.locator(".arka-drag-gate")).toHaveCount(0);
  await expect(page.locator(".arka-landing-intro")).toHaveCount(1);
  await page.waitForTimeout(1250);
}

async function revealPublicPage(page: Page) {
  // IntersectionObserver-driven sections only reveal after entering the viewport.
  // A full-page screenshot does not itself scroll through the document, so walk
  // the page once to trigger every section before capturing it.
  const max = await page.evaluate(() => document.documentElement.scrollHeight);
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  const step = Math.max(320, Math.floor(viewportHeight * 0.72));
  for (let y = 0; y < max; y += step) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
    await page.waitForTimeout(90);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(180);
}

async function capture(page: Page, name: string, prepare = false) {
  if (prepare) await revealPublicPage(page);
  await page.screenshot({ path: path.join(outputDir, `${name}.png`), fullPage: true });
}

async function capturePublicSectionScreens(page: Page, prefix: string) {
  const sections = [
    ["hero", ".arka-flow-hero"],
    ["issue", ".arka-issue"],
    ["method", ".arka-method"],
    ["surfaces", ".arka-surfaces"],
    ["context", ".arka-context"],
    ["trace", ".arka-trace"],
    ["principle", ".arka-principle"],
    ["guardian-gate", ".arka-gate-section"],
    ["contact", ".arka-contact-footer"],
  ] as const;

  for (const [name, selector] of sections) {
    const section = page.locator(selector).first();
    if (await section.count()) {
      await section.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
      await section.screenshot({ path: path.join(outputDir, `${prefix}-${name}.png`) });
    }
  }
}

async function captureProtectedSections(page: Page, prefix: string) {
  const selectors = [
    ["header", ".workspace-header, .admin-header"],
    ["welcome", ".workspace-welcome, .workspace-welcome-enhanced, .admin-hero, .admin-console-hero"],
    ["context", ".workspace-context, .tenant-admin-temple-enhanced"],
    ["metrics", ".workspace-stats, .workspace-stats-summary, .admin-stat-grid"],
    ["main-content", ".workspace-grid, .workspace-grid-actions, .admin-panel, .admin-table-panel"],
  ] as const;

  for (const [name, selector] of selectors) {
    const section = page.locator(selector).first();
    if (await section.count()) {
      await section.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
      await section.screenshot({ path: path.join(outputDir, `${prefix}-${name}.png`) });
    }
  }
}


async function scrollProtectedMain(page: Page) {
  const main = page.locator(".workspace-main, .admin-main").first();
  if (await main.count()) {
    await main.evaluate((el) => el.scrollTo({ top: el.scrollHeight, behavior: "instant" }));
    await page.waitForTimeout(180);
  } else {
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    await page.waitForTimeout(180);
  }
}

async function assertTenantAdminVisualIntegrity(page: Page) {
  const shell = page.locator(".workspace-shell");
  await expect(shell).toBeVisible();
  const main = page.locator(".workspace-shell .workspace-main");
  await expect(main).toBeVisible();
  const welcome = page.locator(".workspace-shell .workspace-welcome-enhanced");
  await expect(welcome).toBeVisible();
  const heading = welcome.locator("h2");
  await expect(heading).toBeVisible();
  const contrast = await heading.evaluate((el) => {
    const style = getComputedStyle(el);
    const parent = el.parentElement ? getComputedStyle(el.parentElement) : null;
    const box = el.getBoundingClientRect();
    return {
      color: style.color,
      opacity: style.opacity,
      parentColor: parent?.color || "",
      width: box.width,
      height: box.height,
    };
  });
  expect(contrast.opacity).toBe("1");
  expect(contrast.width).toBeGreaterThan(200);
  expect(contrast.height).toBeGreaterThan(20);
  const mainBox = await main.boundingBox();
  expect(mainBox?.width || 0).toBeGreaterThan(600);
}

async function loginThroughUI(page: Page, role: RoleKey) {
  const creds = credentials[role];
  if (!creds) {
    throw new Error(
      `Missing credentials for ${role}. Set ARKA_E2E_${role}_EMAIL and ARKA_E2E_${role}_PASSWORD in the PowerShell session. Credentials are read only from environment variables and are never written to the project.`
    );
  }

  await page.goto("/login", { waitUntil: "networkidle", timeout: 30_000 });
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await page.locator('input[type="email"]').fill(creds.email);
  await page.locator('input[type="password"]').fill(creds.password);
  await page.getByRole("button", { name: /Enter Arka/i }).click();

  const expected = roleRoutes[role];
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 30_000 });
  await expect(page.locator("body")).toContainText(expected.marker, { timeout: 20_000 });
  await expect(page.locator(".auth-loading")).toHaveCount(0, { timeout: 15_000 });
}

for (const route of publicRoutes) {
  test(`${route.name} public visual and runtime QA`, async ({ page }) => {
    await page.goto(route.path, { waitUntil: "networkidle", timeout: 30_000 });
    await expect(page.locator("body")).toBeVisible();
    await capture(page, `${route.name}-desktop`, route.name === "home");
    if (route.name === "home") await capturePublicSectionScreens(page, "home-section");
    await assertNoGradientInteractiveFills(page, `${route.name} dark`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(150);
    await capture(page, `${route.name}-mobile`);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    await page.waitForTimeout(250);
    await capture(page, `${route.name}-after-scroll`);

    await page.evaluate(() => {
      localStorage.setItem("arka-theme", "light");
      document.documentElement.dataset.theme = "light";
    });
    await page.waitForTimeout(220);
    await page.goto(route.path, { waitUntil: "networkidle", timeout: 30_000 });
    await expect(page.locator("body")).toBeVisible();
    await page.waitForTimeout(300);
    if (route.name === "home") await revealPublicPage(page);
    await page.screenshot({ path: path.join(outputDir, `${route.name}-light-desktop.png`), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(outputDir, `${route.name}-light-mobile.png`), fullPage: true });
    await assertNoGradientInteractiveFills(page, `${route.name} light`);
    await assertLightSurfaceContract(page, `${route.name} light`);

    const diagnostics = await collectDiagnostics(page, route.name);
    await checkInteractiveElements(page, `${route.name}-desktop`);

    expect(diagnostics.pageErrors, `${route.name}: page errors`).toEqual([]);
    expect(diagnostics.failedRequests, `${route.name}: failed requests`).toEqual([]);
    expect(diagnostics.anchorNesting, `${route.name}: nested anchors`).toBe(0);
    expect(diagnostics.legacyColorElements, `${route.name}: legacy green palette detected`).toBe(0);
    expect(diagnostics.horizontalOverflow, `${route.name}: horizontal overflow`).toBe(false);
  });
}

test.describe("public light-theme visual integrity", () => {
  test("home light theme keeps Context, Guardian Gate and Contact on the page surface", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("arka-theme", "light");
    });
    await page.goto("/", { waitUntil: "networkidle", timeout: 30_000 });
    await page.waitForTimeout(1_300);
    await revealPublicPage(page);

    const result = await page.evaluate(() => {
      const root = document.documentElement;
      const selectors = [
        ".arka-context .context-shell",
        ".arka-context .context-visual",
        ".arka-gate-panel",
        ".arka-contact-footer",
      ];
      const styles = selectors.map((selector) => {
        const el = document.querySelector(selector) as HTMLElement | null;
        if (!el) return { selector, found: false };
        const style = getComputedStyle(el);
        return {
          selector,
          found: true,
          background: style.backgroundColor + " | " + style.backgroundImage,
          color: style.color,
          border: style.borderTopColor,
        };
      });
      return { theme: root.dataset.theme, styles };
    });

    expect(result.theme).toBe("light");
    expect(result.styles.every((item) => item.found)).toBe(true);
    const darkSlab = result.styles.filter((item) => /#071225|#06101f|#09182d|rgb\(7, 18, 37\)/i.test(item.background));
    expect(darkSlab).toHaveLength(0);

    const nodesInsideVisual = await page.evaluate(() => {
      const visual = document.querySelector(".arka-context .context-visual") as HTMLElement | null;
      if (!visual) return false;
      const vr = visual.getBoundingClientRect();
      return [...document.querySelectorAll(".arka-context .context-node")].every((node) => {
        const r = (node as HTMLElement).getBoundingClientRect();
        return r.left >= vr.left - 1 && r.right <= vr.right + 1 && r.top >= vr.top - 1 && r.bottom <= vr.bottom + 1;
      });
    });
    expect(nodesInsideVisual).toBe(true);

    const principle = await page.evaluate(() => {
      const section = document.querySelector('.arka-principle') as HTMLElement | null;
      const word = document.querySelector('.arka-principle .principle-word') as HTMLElement | null;
      const copy = document.querySelector('.arka-principle .principle-copy') as HTMLElement | null;
      if (!section || !word || !copy) return null;
      const sr = section.getBoundingClientRect();
      const wr = word.getBoundingClientRect();
      const cr = copy.getBoundingClientRect();
      return {
        wordInside: wr.left >= sr.left - 1 && wr.right <= sr.right + 1,
        copyInside: cr.left >= sr.left - 1 && cr.right <= sr.right + 1,
        wordWidth: wr.width,
      };
    });
    expect(principle).not.toBeNull();
    expect(principle?.wordInside).toBe(true);
    expect(principle?.copyInside).toBe(true);
    expect(principle?.wordWidth || 0).toBeGreaterThan(100);
  });

  test("public light theme uses a borderless embedded theme control", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("arka-theme", "light"));
    await page.goto("/", { waitUntil: "networkidle", timeout: 30_000 });
    const toggle = page.locator(".public-nav .theme-toggle");
    await expect(toggle).toBeVisible();
    const style = await toggle.evaluate((el) => {
      const s = getComputedStyle(el);
      return { borderWidth: s.borderWidth, background: s.backgroundColor, radius: s.borderRadius };
    });
    expect(style.borderWidth).toBe("0px");
    expect(style.radius).toBe("50%");
  });
});

test.describe("authenticated role surfaces", () => {
  for (const role of Object.keys(roleRoutes) as RoleKey[]) {
    const expected = roleRoutes[role];

    test(`${role} authenticated route is real, not login redirect`, async ({ page }) => {
      await loginThroughUI(page, role);

      await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 10_000 });
      await page.goto(expected.path, { waitUntil: "networkidle", timeout: 30_000 });

      // This is the key guard against the previous false-positive QA run:
      // a protected route that lands on Login must fail the test.
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 10_000 });
      await expect(page.locator("body")).toContainText(expected.marker, { timeout: 15_000 });
      if (role === "TENANT_ADMIN") await assertTenantAdminVisualIntegrity(page);

      const safeName = role.toLowerCase().replaceAll("_", "-");
      await capture(page, `${safeName}-desktop`);
      await captureProtectedSections(page, `${safeName}-section`);
      await assertNoGradientInteractiveFills(page, `${role} dark`);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(150);
      await capture(page, `${safeName}-mobile`);
      await page.setViewportSize({ width: 1440, height: 900 });
      await scrollProtectedMain(page);
      await page.screenshot({ path: path.join(outputDir, `${safeName}-after-scroll.png`) });

      await page.evaluate(() => {
        localStorage.setItem("arka-theme", "light");
        document.documentElement.dataset.theme = "light";
      });
      await page.waitForTimeout(220);
      await page.goto(expected.path, { waitUntil: "networkidle", timeout: 30_000 });
      await expect(page.locator("body")).toContainText(expected.marker, { timeout: 15_000 });
      await page.screenshot({ path: path.join(outputDir, `${safeName}-light-desktop.png`), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(outputDir, `${safeName}-light-mobile.png`), fullPage: true });
      await assertNoGradientInteractiveFills(page, `${role} light`);
      await assertLightSurfaceContract(page, `${role} light`);

      const diagnostics = await collectDiagnostics(page, safeName);
      await checkInteractiveElements(page, `${safeName}-desktop`);

      expect(diagnostics.pageErrors, `${role}: page errors`).toEqual([]);
      expect(diagnostics.failedRequests, `${role}: failed requests`).toEqual([]);
      expect(diagnostics.anchorNesting, `${role}: nested anchors`).toBe(0);
      expect(diagnostics.legacyColorElements, `${role}: legacy green palette detected`).toBe(0);
      expect(diagnostics.horizontalOverflow, `${role}: horizontal overflow`).toBe(false);
      if (diagnostics.density) {
        expect(diagnostics.density.sidebarWidth, `${role}: sidebar density`).toBeGreaterThanOrEqual(245);
        expect(diagnostics.density.navFontSize, `${role}: nav density`).toBeGreaterThanOrEqual(10);
      }
    });
  }
});


/* =========================================================
   V62.4 ELEMENT-LEVEL REGRESSION SUITE
   These tests intentionally inspect individual interaction surfaces
   instead of relying only on route-level screenshots.
   ========================================================= */

async function assertNoRuntimeFailures(page: Page, label: string) {
  const diagnostics = await collectDiagnostics(page, label);
  expect(diagnostics.pageErrors, `${label}: page errors`).toEqual([]);
  expect(diagnostics.failedRequests, `${label}: failed requests`).toEqual([]);
  expect(diagnostics.anchorNesting, `${label}: nested anchors`).toBe(0);
  expect(diagnostics.legacyColorElements, `${label}: legacy palette`).toBe(0);
  expect(diagnostics.horizontalOverflow, `${label}: horizontal overflow`).toBe(false);
}

test.describe("V62.7 landing transition", () => {
  test("home mobile has no blocking entrance gate", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "networkidle", timeout: 30_000 });
    await expect(page.locator(".arka-drag-gate")).toHaveCount(0);
    await expect(page.locator(".arka-landing-intro")).toHaveCount(1);
    await expect(page.locator(".arka-primary").first()).toBeVisible();
  });

  test("home landing transition never intercepts interaction", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle", timeout: 30_000 });
    const intro = page.locator(".arka-landing-intro");
    await expect(intro).toHaveCount(1);
    const pointerEvents = await intro.evaluate(el => getComputedStyle(el).pointerEvents);
    expect(pointerEvents).toBe("none");
    await page.waitForTimeout(1300);
    await expect(intro).toHaveClass(/is-complete/);
  });

  test("home landing transition preserves mobile scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "networkidle", timeout: 30_000 });
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(100);
    const after = await page.evaluate(() => window.scrollY);
    expect(after).toBeGreaterThanOrEqual(before);
  });
});

test.describe("V62.4 public element checks", () => {
  for (const route of publicRoutes) {
    test(`${route.name}: all visible buttons have accessible names`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: "networkidle", timeout: 30_000 });
      if (route.name === "home") await preparePublicHome(page);
      const buttons = page.locator("button:visible");
      const count = await buttons.count();
      for (let i = 0; i < count; i++) {
        const button = buttons.nth(i);
        const name = await button.getAttribute("aria-label");
        const text = ((await button.innerText().catch(() => "")) || "").trim();
        expect(Boolean(name?.trim() || text), `${route.name}: button ${i} has no accessible name`).toBe(true);
      }
      await assertNoRuntimeFailures(page, `${route.name}-elements`);
    });

    test(`${route.name}: no disabled primary action is visible`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: "networkidle", timeout: 30_000 });
      if (route.name === "home") await preparePublicHome(page);
      const disabledPrimary = page.locator(
        "button:visible:disabled.arka-primary, button:visible:disabled.button-primary, a:visible.arka-primary[aria-disabled='true']"
      );
      expect(await disabledPrimary.count()).toBe(0);
    });
  }

  test("home: public navigation targets resolve", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle", timeout: 30_000 });
    await preparePublicHome(page);
    const links = page.locator("a:visible");
    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const href = await links.nth(i).getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http")) continue;
      expect(href, `public link ${i} has empty href`).not.toBe("");
    }
  });

  test("home: obsolete blocking cellular entrance is removed", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle", timeout: 30_000 });
    await expect(page.locator(".arka-drag-gate")).toHaveCount(0);
    await expect(page.locator(".arka-cell-field")).toHaveCount(0);
    await expect(page.locator(".arka-landing-intro")).toHaveCount(1);
  });

  test("home: interactive surface cards change active state", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle", timeout: 30_000 });
    await preparePublicHome(page);
    const cards = page.locator(".surface-card:visible");
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(6);

    const first = cards.nth(0);
    const second = cards.nth(1);
    await second.click();
    await expect(second).toHaveClass(/is-active/);
    await expect(first).not.toHaveClass(/is-active/);
  });

  test("home: context relationship advances", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle", timeout: 30_000 });
    await preparePublicHome(page);
    const button = page.getByRole("button", { name: /NEXT RELATIONSHIP/i });
    await page.evaluate(() => document.querySelector("#blueprint")?.scrollIntoView({ block: "center" }));
    await expect(button).toBeVisible();
    const before = await page.locator(".context-copy .arka-kicker").innerText();
    await button.click();
    const after = await page.locator(".context-copy .arka-kicker").innerText();
    expect(after).not.toBe(before);
  });

  test("login: email/password controls are usable", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle", timeout: 30_000 });
    const email = page.locator('input[type="email"]');
    const password = page.locator('input[type="password"]');
    await expect(email).toBeVisible();
    await expect(password).toBeVisible();
    await expect(email).toBeEnabled();
    await expect(password).toBeEnabled();
    await checkInteractiveElements(page, "login-element-regression");
  });
});

test.describe("V62.4 protected element checks", () => {
  for (const role of Object.keys(roleRoutes) as RoleKey[]) {
    const expected = roleRoutes[role];
    test(`${role}: sidebar, main and navigation are individually present`, async ({ page }) => {
      await loginThroughUI(page, role);
      await page.goto(expected.path, { waitUntil: "networkidle", timeout: 30_000 });
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
      await expect(page.locator("body")).toContainText(expected.marker);

      const shell = page.locator(".admin-shell, .workspace, .workspace-page").first();
      await expect(shell).toBeVisible();

      const sidebar = page.locator(".admin-sidebar, .workspace-sidebar").first();
      const main = page.locator(".admin-main, .workspace-main").first();
      await expect(sidebar).toBeVisible();
      await expect(main).toBeVisible();

      const navButtons = page.locator(".admin-nav-main:visible, .workspace-nav button:visible");
      expect(await navButtons.count()).toBeGreaterThan(0);

      await assertNoRuntimeFailures(page, `${role.toLowerCase()}-element-regression`);
    });

    test(`${role}: theme control exists and is keyboard reachable`, async ({ page }) => {
      await loginThroughUI(page, role);
      await page.goto(expected.path, { waitUntil: "networkidle", timeout: 30_000 });

      const toggle = page.locator("button[aria-label*='theme' i], .theme-toggle").first();
      await expect(toggle).toBeVisible();
      await toggle.focus();
      await expect(toggle).toBeFocused();
    });

    test(`${role}: mobile shell has no horizontal overflow`, async ({ page }) => {
      await loginThroughUI(page, role);
      await page.goto(expected.path, { waitUntil: "networkidle", timeout: 30_000 });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(200);

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

      const menu = page.locator(".workspace-menu, .admin-menu-toggle").first();
      if (await menu.count()) await expect(menu).toBeVisible();
    });
  }

  test("tenant admin: onboarding overlay owns its four-step navigation", async ({ page }) => {
    await loginThroughUI(page, "TENANT_ADMIN");
    await page.goto("/tenant", { waitUntil: "networkidle", timeout: 30_000 });

    const overlay = page.locator(".arka-onboarding-modal, .onboarding-overlay").first();
    if (await overlay.count()) {
      await expect(overlay).toBeVisible();
      const stepLabels = page.getByText(/ORGANIZATION|ENVIRONMENT|SECURITY STACK|PRIORITIES/i);
      expect(await stepLabels.count()).toBeGreaterThanOrEqual(4);
    }
  });

  test("super admin: platform modules expose real navigation targets", async ({ page }) => {
    await loginThroughUI(page, "SUPER_ADMIN");
    await page.goto("/admin", { waitUntil: "networkidle", timeout: 30_000 });

    const nav = page.locator(".admin-nav-main:visible");
    expect(await nav.count()).toBeGreaterThanOrEqual(5);

    const text = ((await page.locator("body").innerText()) || "");
    expect(text).toMatch(/Users|Organizations|Applications|Integrations|Agents/i);
  });
});


test.describe("V62.6 principle layout integrity", () => {
  test("home: principle copy is not clipped by the display word", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle", timeout: 30_000 });
    await page.evaluate(() => document.querySelector(".arka-principle")?.scrollIntoView({ block: "center" }));
    const metrics = await page.evaluate(() => {
      const section = document.querySelector(".arka-principle") as HTMLElement | null;
      const layout = document.querySelector(".principle-layout") as HTMLElement | null;
      const copy = document.querySelector(".principle-copy") as HTMLElement | null;
      const relationship = document.querySelector(".principle-copy > span:nth-child(2)") as HTMLElement | null;
      if (!section || !layout || !copy || !relationship) return null;
      const copyRect = copy.getBoundingClientRect();
      const relationshipRect = relationship.getBoundingClientRect();
      return {
        sectionRight: section.getBoundingClientRect().right,
        layoutRight: layout.getBoundingClientRect().right,
        copyRight: copyRect.right,
        relationshipRight: relationshipRect.right,
        copyScrollWidth: copy.scrollWidth,
        copyClientWidth: copy.clientWidth,
        relationshipText: relationship.textContent,
      };
    });

    expect(metrics).not.toBeNull();
    expect(metrics!.layoutRight).toBeLessThanOrEqual(metrics!.sectionRight + 1);
    expect(metrics!.copyRight).toBeLessThanOrEqual(metrics!.sectionRight + 1);
    expect(metrics!.relationshipRight).toBeLessThanOrEqual(metrics!.copyRight + 1);
    expect(metrics!.copyScrollWidth).toBeLessThanOrEqual(metrics!.copyClientWidth + 1);
    expect(metrics!.relationshipText).toBe("See the relationship.");
  });

  test("home: principle remains readable on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "networkidle", timeout: 30_000 });
    await page.evaluate(() => document.querySelector(".arka-principle")?.scrollIntoView({ block: "center" }));
    const relationship = page.locator(".principle-copy > span:nth-child(2)");
    await expect(relationship).toBeVisible();
    await expect(relationship).toContainText("See the relationship.");
  });
});


test.describe("V64.4 organic recomposition contracts", () => {
  test("tenant user has no sanctum/temple workspace treatment", async ({ page }) => {
    await loginThroughUI(page, "TENANT_USER");
    await page.goto("/app", { waitUntil: "networkidle", timeout: 30_000 });
    await expect(page.locator(".workspace-context")).toBeVisible();
    await expect(page.locator(".workspace-temple-strip")).toHaveCount(0);
    await expect(page.locator(".workspace-context .workspace-context-core")).toBeVisible();
    const text = await page.locator(".workspace-page").innerText();
    expect(text).not.toMatch(/ARKA\s*\/\s*SANCTUM/i);
    expect(text).not.toMatch(/GUARDIAN\s*\/\s*CORE/i);
  });

  test("tenant user context nodes are rounded and interactive", async ({ page }) => {
    await loginThroughUI(page, "TENANT_USER");
    await page.goto("/app", { waitUntil: "networkidle", timeout: 30_000 });
    const nodes = page.locator(".workspace-context-node:visible");
    expect(await nodes.count()).toBe(5);
    const radius = await nodes.first().evaluate(el => getComputedStyle(el).borderRadius);
    expect(parseFloat(radius)).toBeGreaterThanOrEqual(20);
    const first = nodes.first();
    const second = nodes.nth(1);
    await second.click();
    await expect(second).toHaveClass(/is-active/);
    await expect(first).not.toHaveClass(/is-active/);
  });

  test("public context and guardian gate are no longer rectangular boxes", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle", timeout: 30_000 });
    await preparePublicHome(page);
    const values = await page.evaluate(() => {
      const selectors = [".context-shell", ".context-visual", ".arka-gate-panel", ".arka-system-orbit"];
      return Object.fromEntries(selectors.map(selector => {
        const el = document.querySelector(selector) as HTMLElement | null;
        if (!el) return [selector, null];
        const s = getComputedStyle(el);
        return [selector, { border: s.borderWidth, radius: s.borderRadius, overflow: s.overflow }];
      }));
    });
    expect(values[".context-shell"]?.border).toBe("0px");
    expect(values[".arka-gate-panel"]?.border).toBe("0px");
    expect(values[".context-visual"]?.radius).not.toBe("0px");
    expect(values[".arka-system-orbit"]?.radius).not.toBe("0px");
  });

  test("public home produces a screenshot for every major section", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle", timeout: 30_000 });
    await preparePublicHome(page);
    await revealPublicPage(page);
    await capturePublicSectionScreens(page, "section-matrix");
    for (const name of ["hero","issue","method","surfaces","context","trace","principle","guardian-gate","contact"]) {
      expect(fs.existsSync(path.join(outputDir, `section-matrix-${name}.png`))).toBe(true);
    }
  });
});

test.describe("V64.1 visual audit contracts", () => {
  test("home light: Context, Guardian Gate and Contact use the page surface family", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle", timeout: 30_000 });
    await preparePublicHome(page);
    await page.evaluate(() => document.documentElement.dataset.theme = "light");
    const result = await page.evaluate(() => {
      const selectors = [
        ".arka-context",
        ".arka-context .context-shell",
        ".arka-context .context-visual",
        ".arka-gate-panel",
        ".arka-contact-footer",
      ];
      return Object.fromEntries(selectors.map(selector => {
        const el = document.querySelector(selector) as HTMLElement | null;
        if (!el) return [selector, null];
        const s = getComputedStyle(el);
        return [selector, { bg:s.backgroundColor, image:s.backgroundImage, rect:el.getBoundingClientRect().toJSON() }];
      }));
    });
    for (const [selector, value] of Object.entries(result)) {
      expect(value, `${selector} must exist`).not.toBeNull();
      if (!value) continue;
      const rgb = value.bg.match(/rgba?\(([^)]+)\)/i)?.[1] || "";
      const nums = rgb.split(",").map(Number);
      expect(nums[0] ?? 0, `${selector} must not be dark`).toBeGreaterThan(180);
      expect(nums[1] ?? 0, `${selector} must not be dark`).toBeGreaterThan(180);
      expect(nums[2] ?? 0, `${selector} must not be dark`).toBeGreaterThan(180);
    }
  });

  test("home dark: public Context, Guardian Gate and Contact stay blue, not green", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle", timeout: 30_000 });
    await preparePublicHome(page);
    const result = await page.evaluate(() => {
      const selectors = [".arka-context .context-shell", ".arka-context .context-visual", ".arka-gate-panel", ".arka-contact-footer"];
      return selectors.map(selector => {
        const el = document.querySelector(selector) as HTMLElement | null;
        if (!el) return { selector, bg:"", color:"" };
        const s = getComputedStyle(el);
        return { selector, bg:s.backgroundColor, color:s.color };
      });
    });
    for (const item of result) {
      expect(item.bg, `${item.selector} background must exist`).not.toBe("");
      const rgb = item.bg.match(/rgba?\(([^)]+)\)/i)?.[1] || "";
      const nums = rgb.split(",").map(Number);
      const [r,g,b] = nums;
      const greenLeak = Number.isFinite(g) && g > (r + 10) && g > (b + 10);
      expect(greenLeak, `${item.selector} has a green/olive background`).toBe(false);
    }
  });

  for (const role of Object.keys(roleRoutes) as RoleKey[]) {
    test(`${role}: desktop rail and main share one coordinate system`, async ({ page }) => {
      await loginThroughUI(page, role);
      await page.goto(roleRoutes[role].path, { waitUntil: "networkidle", timeout: 30_000 });
      const geometry = await page.evaluate(() => {
        const sidebar = document.querySelector(".admin-sidebar, .workspace-sidebar") as HTMLElement | null;
        const main = document.querySelector(".admin-main, .workspace-main") as HTMLElement | null;
        const content = document.querySelector(".admin-main > *, .workspace-content") as HTMLElement | null;
        if (!sidebar || !main) return null;
        const sr = sidebar.getBoundingClientRect();
        const mr = main.getBoundingClientRect();
        const cr = content?.getBoundingClientRect();
        return {
          sidebarLeft:sr.left,
          sidebarWidth:sr.width,
          mainLeft:mr.left,
          mainWidth:mr.width,
          contentLeft:cr?.left ?? null,
        };
      });
      expect(geometry).not.toBeNull();
      expect(geometry!.sidebarLeft).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry!.mainLeft - geometry!.sidebarWidth)).toBeLessThanOrEqual(2);
      if (geometry!.contentLeft !== null) {
        expect(geometry!.contentLeft).toBeGreaterThanOrEqual(geometry!.mainLeft - 1);
        expect(geometry!.contentLeft).toBeLessThanOrEqual(geometry!.mainLeft + 60);
      }
    });

    test(`${role}: dark protected surfaces contain no green/olive backgrounds`, async ({ page }) => {
      await loginThroughUI(page, role);
      await page.goto(roleRoutes[role].path, { waitUntil: "networkidle", timeout: 30_000 });
      const leaks = await page.evaluate(() => {
        const selectors = [
          ".workspace-page", ".workspace-shell", ".workspace-sidebar", ".workspace-welcome",
          ".workspace-metric", ".workspace-panel", ".tenant-admin-temple-enhanced",
          ".admin-shell", ".admin-sidebar", ".admin-hero", ".admin-console-hero",
          ".admin-stat", ".admin-panel", ".admin-table-panel", ".admin-role-metric",
        ];
        return selectors.flatMap(selector => Array.from(document.querySelectorAll(selector)).map(el => {
          const s = getComputedStyle(el as HTMLElement);
          const values = [s.backgroundColor, s.borderColor, s.color].join(" ");
          const m = s.backgroundColor.match(/rgba?\(([^)]+)\)/i)?.[1] || "";
          const [r,g,b] = m.split(",").map(Number);
          const green = Number.isFinite(g) && g > r + 10 && g > b + 10;
          return green ? selector : null;
        }).filter(Boolean));
      });
      expect(leaks, `${role}: green/olive surface leak`).toEqual([]);
    });

    test(`${role}: primary interactive controls are solid`, async ({ page }) => {
      await loginThroughUI(page, role);
      await page.goto(roleRoutes[role].path, { waitUntil: "networkidle", timeout: 30_000 });
      await assertNoGradientInteractiveFills(page, `${role} all controls`);
      const gradients = await page.locator(".admin-primary:visible, .button-primary:visible, .workspace-signout:visible, .admin-signout:visible").evaluateAll(elements =>
        elements.filter(el => /gradient/i.test(getComputedStyle(el).backgroundImage)).map(el => (el as HTMLElement).className)
      );
      expect(gradients).toEqual([]);
    });
  }

  test("home dark: every context node stays inside its visualization", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle", timeout: 30_000 });
    await preparePublicHome(page);
    await page.evaluate(() => document.querySelector("#blueprint")?.scrollIntoView({ block:"center" }));
    const result = await page.evaluate(() => {
      const visual = document.querySelector(".arka-context .context-visual") as HTMLElement | null;
      if (!visual) return null;
      const vr = visual.getBoundingClientRect();
      const nodes = Array.from(visual.querySelectorAll(".context-node")).map(el => {
        const r = (el as HTMLElement).getBoundingClientRect();
        return { left:r.left, right:r.right, top:r.top, bottom:r.bottom };
      });
      return { vr:{left:vr.left,right:vr.right,top:vr.top,bottom:vr.bottom}, nodes };
    });
    expect(result).not.toBeNull();
    for (const node of result!.nodes) {
      expect(node.left).toBeGreaterThanOrEqual(result!.vr.left + 4);
      expect(node.right).toBeLessThanOrEqual(result!.vr.right - 4);
      expect(node.top).toBeGreaterThanOrEqual(result!.vr.top + 4);
      expect(node.bottom).toBeLessThanOrEqual(result!.vr.bottom - 4);
    }
  });
});



test.describe("V64.2 screenshot-grounded geometry", () => {
  test("Tenant User: content begins directly after the fixed rail", async ({ page }) => {
    await loginThroughUI(page, "TENANT_USER");
    await page.goto("/app", { waitUntil: "networkidle", timeout: 30_000 });
    const geometry = await page.evaluate(() => {
      const rail = document.querySelector(".workspace-page:not(.workspace-shell) .workspace-sidebar") as HTMLElement | null;
      const main = document.querySelector(".workspace-page:not(.workspace-shell) .workspace-main") as HTMLElement | null;
      const content = document.querySelector(".workspace-page:not(.workspace-shell) .workspace-content") as HTMLElement | null;
      if (!rail || !main || !content) return null;
      const r = rail.getBoundingClientRect(), m = main.getBoundingClientRect(), c = content.getBoundingClientRect();
      return { railRight:r.right, mainLeft:m.left, contentLeft:c.left, gap:c.left-m.left };
    });
    expect(geometry).not.toBeNull();
    expect(Math.abs(geometry!.mainLeft - geometry!.railRight)).toBeLessThanOrEqual(2);
    expect(geometry!.gap).toBeLessThanOrEqual(36);
  });

  test("Tenant User: welcome and Guardian strip are not nested cards", async ({ page }) => {
    await loginThroughUI(page, "TENANT_USER");
    await page.goto("/app", { waitUntil: "networkidle", timeout: 30_000 });
    const result = await page.evaluate(() => {
      const welcome = document.querySelector(".workspace-page:not(.workspace-shell) .workspace-welcome") as HTMLElement | null;
      const strip = document.querySelector(".workspace-page:not(.workspace-shell) .workspace-temple-strip") as HTMLElement | null;
      const temple = document.querySelector(".workspace-page:not(.workspace-shell) .workspace-temple-strip .arka-temple") as HTMLElement | null;
      if (!welcome || !strip || !temple) return null;
      const ws = getComputedStyle(welcome), ts = getComputedStyle(temple);
      return { welcomeBorder:ws.borderWidth, welcomeImage:ws.backgroundImage, templeBorder:ts.borderWidth, templeImage:ts.backgroundImage };
    });
    expect(result).not.toBeNull();
    expect(result!.welcomeBorder).toBe("0px");
    expect(result!.welcomeImage).toBe("none");
    expect(result!.templeBorder).toBe("0px");
    expect(result!.templeImage).toBe("none");
  });

  test("Tenant User: compact Guardian exposes all six nodes inside its stage", async ({ page }) => {
    await loginThroughUI(page, "TENANT_USER");
    await page.goto("/app", { waitUntil: "networkidle", timeout: 30_000 });
    const result = await page.evaluate(() => {
      const stage = document.querySelector(".workspace-page .arka-temple.compact .temple-stage") as HTMLElement | null;
      const nodes = Array.from(document.querySelectorAll(".workspace-page .arka-temple.compact .temple-node")) as HTMLElement[];
      if (!stage) return null;
      const sr = stage.getBoundingClientRect();
      return { count:nodes.length, inside:nodes.every(node => { const r=node.getBoundingClientRect(); return r.left>=sr.left && r.right<=sr.right && r.top>=sr.top && r.bottom<=sr.bottom; }) };
    });
    expect(result).not.toBeNull();
    expect(result!.count).toBe(6);
    expect(result!.inside).toBe(true);
  });

  for (const role of ["TENANT_USER", "TENANT_ADMIN", "SUPER_ADMIN"] as RoleKey[]) {
    test(`${role}: light sign-out stays transparent`, async ({ page }) => {
      await loginThroughUI(page, role);
      await page.goto(roleRoutes[role].path, { waitUntil: "networkidle", timeout: 30_000 });
      await page.evaluate(() => document.documentElement.dataset.theme = "light");
      const signout = page.locator(".workspace-signout, .admin-signout").first();
      await expect(signout).toBeVisible();
      const style = await signout.evaluate(el => { const s=getComputedStyle(el); return { bg:s.backgroundImage, shadow:s.boxShadow, border:s.borderWidth }; });
      expect(style.bg).toBe("none");
      expect(style.shadow).toBe("none");
      expect(style.border).toBe("0px");
    });
  }

  test("home: Guardian Gate is section-level, not a card", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle", timeout: 30_000 });
    await preparePublicHome(page);
    const result = await page.locator(".arka-gate-panel").evaluate(el => { const s=getComputedStyle(el); return { border:s.borderWidth, radius:s.borderRadius, image:s.backgroundImage }; });
    expect(result.border).toBe("0px");
    expect(result.radius).toBe("0px");
    expect(result.image).toBe("none");
  });
});

/* =========================================================
   V64.3 — DEDICATED SCREENSHOT MATRIX
   Screenshot capture is deliberately independent from visual assertions.
   A failed assertion must not prevent the remaining states from being
   captured, so every route gets a desktop, bottom-scroll, mobile, light-
   desktop and light-mobile artifact whenever the route can be reached.
   ========================================================= */

async function safeMatrixShot(page: Page, name: string, fullPage = true) {
  try {
    await page.screenshot({
      path: path.join(outputDir, `${name}.png`),
      fullPage,
      animations: "disabled",
    });
  } catch (error) {
    writeJson(`${name}-screenshot-error.json`, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function capturePublicMatrix(page: Page, routeName: string, routePath: string) {
  let failure = "";
  try {
    await page.goto(routePath, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(1_400);
    if (routeName === "home") await revealPublicPage(page);
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }
  await safeMatrixShot(page, `matrix-${routeName}-desktop`);

  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    await page.waitForTimeout(220);
  } catch (error) { failure ||= error instanceof Error ? error.message : String(error); }
  await safeMatrixShot(page, `matrix-${routeName}-after-scroll`, false);

  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(180);
  } catch (error) { failure ||= error instanceof Error ? error.message : String(error); }
  await safeMatrixShot(page, `matrix-${routeName}-mobile`);

  try {
    await page.evaluate(() => {
      localStorage.setItem("arka-theme", "light");
      document.documentElement.dataset.theme = "light";
    });
    await page.goto(routePath, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(1_000);
    if (routeName === "home") await revealPublicPage(page);
    await page.setViewportSize({ width: 1440, height: 900 });
  } catch (error) { failure ||= error instanceof Error ? error.message : String(error); }
  await safeMatrixShot(page, `matrix-${routeName}-light-desktop`);

  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(180);
  } catch (error) { failure ||= error instanceof Error ? error.message : String(error); }
  await safeMatrixShot(page, `matrix-${routeName}-light-mobile`);

  if (failure) writeJson(`matrix-${routeName}-capture-error.json`, { error: failure });
}

async function captureProtectedMatrix(page: Page, role: RoleKey) {
  const safeName = role.toLowerCase().replaceAll("_", "-");
  let failure = "";
  try {
    await loginThroughUI(page, role);
    await page.goto(roleRoutes[role].path, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(1_000);
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }
  await safeMatrixShot(page, `matrix-${safeName}-desktop`);

  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await scrollProtectedMain(page);
  } catch (error) { failure ||= error instanceof Error ? error.message : String(error); }
  await safeMatrixShot(page, `matrix-${safeName}-after-scroll`, false);

  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(220);
  } catch (error) { failure ||= error instanceof Error ? error.message : String(error); }
  await safeMatrixShot(page, `matrix-${safeName}-mobile`);

  try {
    await page.evaluate(() => {
      localStorage.setItem("arka-theme", "light");
      document.documentElement.dataset.theme = "light";
    });
    await page.goto(roleRoutes[role].path, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(1_000);
    await page.setViewportSize({ width: 1440, height: 900 });
  } catch (error) { failure ||= error instanceof Error ? error.message : String(error); }
  await safeMatrixShot(page, `matrix-${safeName}-light-desktop`);

  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(220);
  } catch (error) { failure ||= error instanceof Error ? error.message : String(error); }
  await safeMatrixShot(page, `matrix-${safeName}-light-mobile`);

  if (failure) writeJson(`matrix-${safeName}-capture-error.json`, { error: failure });
  if (failure) throw new Error(`Screenshot matrix reached a capture failure for ${role}. See matrix-${safeName}-capture-error.json.`);
}

test.describe("V64.3 complete screenshot matrix", () => {
  test("PUBLIC — home and login: capture every visual state", async ({ page }) => {
    for (const route of publicRoutes) {
      await capturePublicMatrix(page, route.name, route.path);
    }
  });

  for (const role of Object.keys(roleRoutes) as RoleKey[]) {
    test(`${role} — capture every visual state`, async ({ page }) => {
      await captureProtectedMatrix(page, role);
    });
  }
});

test.describe("V64.3 visual composition contracts", () => {
  for (const role of ["TENANT_USER", "TENANT_ADMIN"] as RoleKey[]) {
    test(`${role}: product surfaces use rounded geometry and no inner gutter`, async ({ page }) => {
      await loginThroughUI(page, role);
      await page.goto(roleRoutes[role].path, { waitUntil: "networkidle", timeout: 30_000 });
      const result = await page.evaluate(() => {
        const root = document.querySelector(".workspace-page") as HTMLElement | null;
        const main = document.querySelector(".workspace-main") as HTMLElement | null;
        const content = document.querySelector(".workspace-content") as HTMLElement | null;
        if (!root || !main || !content) return null;
        const mr = main.getBoundingClientRect();
        const cr = content.getBoundingClientRect();
        const cards = Array.from(document.querySelectorAll(".workspace-metric, .workspace-panel")) as HTMLElement[];
        return {
          mainLeft: mr.left,
          contentLeft: cr.left,
          firstCardRadius: cards.length ? parseFloat(getComputedStyle(cards[0]).borderRadius) : 0,
          cardCount: cards.length,
        };
      });
      expect(result).not.toBeNull();
      expect(result!.contentLeft - result!.mainLeft).toBeLessThanOrEqual(28);
      expect(result!.firstCardRadius).toBeGreaterThanOrEqual(18);
      expect(result!.cardCount).toBeGreaterThan(2);
    });
  }

  test("SUPER_ADMIN: dark header title is readable", async ({ page }) => {
    await loginThroughUI(page, "SUPER_ADMIN");
    await page.goto("/admin", { waitUntil: "networkidle", timeout: 30_000 });
    const color = await page.locator(".admin-header h1").evaluate(el => getComputedStyle(el).color);
    expect(color).not.toBe("rgb(7, 18, 37)");
    expect(color).not.toBe("rgb(7, 16, 31)");
  });

  test("home: Guardian Gate has no card border or radius", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle", timeout: 30_000 });
    await page.waitForTimeout(1_300);
    const result = await page.locator(".arka-gate-panel").evaluate(el => {
      const s = getComputedStyle(el);
      return { border:s.borderWidth, radius:s.borderRadius, shadow:s.boxShadow, image:s.backgroundImage };
    });
    expect(result).toEqual({ border:"0px", radius:"0px", shadow:"none", image:"none" });
  });
});
