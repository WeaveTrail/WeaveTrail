import { expect, test, type Page } from "@playwright/test";

import type { Language } from "../src/app/i18n/language";
import { shellCopy } from "../src/app/shell/copy";

const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
] as const;
const LANGUAGES: readonly Language[] = ["en", "ko"];

/**
 * Each route and the block that carries its answer. Every page leads with
 * its answer, so the heading and that block sit in the first screen.
 */
const ROUTES = [
  ["/", ".hero-actions"],
  ["/evals", ".mc-answer"],
  ["/replay", ".journey-header h2"],
  ["/why", ".explainer-answer"],
  ["/architecture", ".explainer-answer"],
  ["/methodology", ".explainer-answer"],
  ["/expectations", ".explainer-answer"],
  ["/data-handling", ".explainer-answer"],
] as const;

async function open(page: Page, path: string, language: Language) {
  await page.addInitScript((value) => {
    window.localStorage.setItem("weavetrail.language", value);
  }, language);
  await page.goto(path);
  await expect(page.locator("html")).toHaveAttribute("lang", language);
}

/** The element's whole box lies inside the first viewport, unscrolled. */
async function expectInFirstViewport(page: Page, selector: string) {
  const viewport = page.viewportSize()!;
  const box = await page.locator(selector).first().boundingBox();
  expect(box, selector).not.toBeNull();
  expect(box!.y, selector).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height, selector).toBeLessThanOrEqual(viewport.height);
  expect(box!.x + box!.width, selector).toBeLessThanOrEqual(viewport.width);
}

for (const viewport of VIEWPORTS)
  for (const language of LANGUAGES)
    for (const [path, answer] of ROUTES)
      test(`leads ${path} with its answer in the first ${viewport.width}x${viewport.height} viewport in ${language}`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await open(page, path, language);
        await expectInFirstViewport(page, "main h1");
        await expectInFirstViewport(page, answer);
        // Nothing on the page scrolls sideways.
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth,
          ),
        ).toBe(true);
      });

/**
 * From the top of a page, presses Tab until the header link to `href` has
 * focus, opening a closed menu with Enter on the way, then follows it.
 */
async function followByKeyboard(page: Page, href: string) {
  await page.locator("body").focus();
  for (let presses = 0; presses < 80; presses++) {
    await page.keyboard.press("Tab");
    const focus = await page.evaluate((target) => {
      const element = document.activeElement as HTMLElement | null;
      return {
        link:
          element?.closest(".site-nav") !== null &&
          element?.getAttribute("href") === target,
        closedMenu:
          element?.classList.contains("site-nav-trigger") === true &&
          element.getAttribute("aria-expanded") === "false" &&
          element.offsetParent !== null,
      };
    }, href);
    if (focus.link) {
      await page.keyboard.press("Enter");
      return;
    }
    if (focus.closedMenu) await page.keyboard.press("Enter");
  }
  throw new Error(`no header link to ${href} reachable by keyboard`);
}

for (const viewport of VIEWPORTS)
  test(`reaches every route from the header by keyboard alone at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const destinations = shellCopy.en.navigation.flatMap(([, items]) =>
      items.map(([, href]) => href),
    );
    expect(destinations.sort()).toEqual(ROUTES.map(([path]) => path).sort());
    await open(page, "/why", "en");
    for (const href of destinations) {
      await followByKeyboard(page, href);
      await expect(page).toHaveURL((url) => url.pathname === href);
      await expect(page.locator("main h1")).toBeVisible();
    }
  });
