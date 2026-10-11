import { expect, test, type Page } from "@playwright/test";

import { homeCopy } from "../src/app/home/copy";
import type { Language } from "../src/app/i18n/language";
import { plainText } from "../src/app/shell/sentence-lines";

const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
] as const;
const LANGUAGES: readonly Language[] = ["en", "ko"];

async function open(page: Page, language: Language) {
  await page.addInitScript((value) => {
    window.localStorage.setItem("weavetrail.language", value);
  }, language);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", language);
}

/** The element's whole box lies inside the first viewport, unscrolled. */
async function expectInFirstViewport(page: Page, selector: string) {
  const viewport = page.viewportSize()!;
  const box = await page.locator(selector).boundingBox();
  expect(box, selector).not.toBeNull();
  expect(box!.y, selector).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height, selector).toBeLessThanOrEqual(viewport.height);
}

/** Presses Tab from the top until the link to `href` has focus. */
async function tabTo(page: Page, href: string) {
  await page.locator("body").focus();
  for (let presses = 0; presses < 60; presses++) {
    await page.keyboard.press("Tab");
    if (
      await page.evaluate(
        (target) =>
          document.activeElement?.getAttribute("href") === target &&
          document.activeElement.closest("main") !== null,
        href,
      )
    )
      return;
  }
  throw new Error(`no focusable link to ${href} in main`);
}

for (const viewport of VIEWPORTS) {
  for (const language of LANGUAGES) {
    test(`leads with the gain and the walkthrough in the first ${viewport.width}x${viewport.height} viewport in ${language}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await open(page, language);

      // What a reviewer gains comes first, and the walkthrough is the one
      // action offered.
      await expect(page.locator("#home-title")).toHaveText(
        plainText(homeCopy[language].intro.title),
      );
      await expect(page.locator("main .hero-actions a")).toHaveCount(1);
      await expect(
        page.locator("main .hero-actions a").first(),
      ).toHaveAttribute("href", "/replay?mode=guided");
      for (const selector of [
        "#home-title",
        ".home-lede",
        '.hero-actions a[href="/replay?mode=guided"]',
      ])
        await expectInFirstViewport(page, selector);
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
    });
  }
}

for (const [href, path] of [
  ["/evals", "/evals"],
  ["/replay?mode=guided", "/replay"],
] as const) {
  test(`reaches ${path} with the keyboard alone`, async ({ page }) => {
    await open(page, "en");
    await tabTo(page, href);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`${path.replace("/", "\\/")}`));
    expect(new URL(page.url()).pathname).toBe(path);
  });
}

for (const language of LANGUAGES) {
  test(`shows the four stages beside the opening at 1280x720 in ${language}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await open(page, language);
    await expect(page.locator(".home-flow li")).toHaveCount(4);
    // The stages sit under the flow's own level-two heading.
    await expect(page.locator(".home-flow figcaption h2")).toBeVisible();
    await expectInFirstViewport(page, ".home-flow");
  });
}

test("keeps the header on one row and opens every destination from the menu at 390x844", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "ko");
  const header = await page.locator(".site-header").boundingBox();
  expect(header!.height).toBeLessThanOrEqual(72);
  const button = page.locator(".site-nav-menu-button");
  await expect(button).toBeVisible();
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(button).toHaveAttribute("aria-expanded", "true");
  const panel = page.locator(".site-nav-panel");
  for (const href of ["/", "/evals", "/replay", "/why", "/architecture"])
    await expect(panel.locator(`a[href="${href}"]`)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(button).toBeFocused();
});

test("closes an open menu when the width crosses the tablet breakpoint", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await open(page, "en");
  const trigger = page.locator(".site-nav-trigger:not(.site-nav-menu-button)");
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".site-nav-panel")).toBeHidden();
  await expect(page.locator(".site-nav-menu-button")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

for (const width of [320, 375]) {
  test(`keeps the header controls within a ${width}px screen in tab order`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 700 });
    await open(page, "ko");
    const controls = [
      page.locator(".wordmark"),
      page.locator(".site-nav-menu-button"),
      page.locator(".language-selector button").last(),
    ];
    let previousRight = -1;
    for (const control of controls) {
      const box = (await control.boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.x).toBeGreaterThan(previousRight - 1);
      previousRight = box.x + box.width;
    }
    for (const control of [
      page.locator(".site-nav-menu-button"),
      ...(await page.locator(".language-selector button").all()),
    ])
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(40);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

for (const language of LANGUAGES) {
  test(`keeps the full bar clear of the language switch at 897px in ${language}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 897, height: 700 });
    await open(page, language);
    await expect(page.locator(".site-nav-menu-button")).toBeHidden();
    const switcher = (await page.locator(".language-selector").boundingBox())!;
    for (const control of await page
      .locator(".site-nav-bar a, .site-nav-more > button")
      .all()) {
      if (!(await control.isVisible())) continue;
      const box = (await control.boundingBox())!;
      expect(box.x + box.width).toBeLessThan(switcher.x);
    }
  });
}

test("does not reopen a menu after leaving its page and coming back", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await open(page, "en");
  await page.locator(".site-nav-trigger:not(.site-nav-menu-button)").click();
  await expect(page.locator(".site-nav-panel")).toBeVisible();
  await page.locator('.site-nav-bar a[href="/evals"]').click();
  await expect(page).toHaveURL(/\/evals$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".site-nav-panel")).toBeHidden();
});

test("opens the how-it-works menu from the bar at 1280x720", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await open(page, "en");
  await expect(page.locator('.site-nav-bar a[href="/evals"]')).toBeVisible();
  const trigger = page.locator(".site-nav-trigger:not(.site-nav-menu-button)");
  await trigger.click();
  const panel = page.locator(".site-nav-panel");
  await expect(panel.locator('a[href="/architecture"]')).toBeVisible();
  // The bar already holds the first group, so the menu does not repeat it.
  await expect(panel.locator('a[href="/evals"]')).toBeHidden();
  await panel.locator('a[href="/architecture"]').click();
  await expect(page).toHaveURL(/\/architecture$/);
  await expect(panel).toBeHidden();
  await expect(trigger).toHaveAttribute("data-current", "true");
});

test.describe("on the guided walkthrough at 1280x720", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("shows every row of the worked case in one table at the first step", async ({
    page,
  }) => {
    await page.addInitScript(() =>
      window.localStorage.setItem("weavetrail.language", "en"),
    );
    await page.goto("/replay");
    const rows = page.locator(".tour-table tbody tr");
    await expect(rows).toHaveCount(6);
    await expect(rows.first()).toBeInViewport();
  });
});
