import { expect, test, type Page } from "@playwright/test";

import { committedHeldOutResult } from "../src/app/evals/held-out-result";
import { HOME_TERM_KEYS, homeCopy, plainText } from "../src/app/home-content";
import { homeSelection } from "../src/app/home-selection";
import type { Language } from "../src/app/i18n/language";

const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
] as const;
const LANGUAGES: readonly Language[] = ["en", "ko"];
const selection = homeSelection(committedHeldOutResult);

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
    test(`answers the question in the first ${viewport.width}x${viewport.height} viewport in ${language}`, async ({
      page,
    }) => {
      const answer = homeCopy[language].answer;
      await page.setViewportSize(viewport);
      await open(page, language);

      // The committed recovery session observed output, but no candidate
      // passed the rule: no selection is published.
      expect(selection).toEqual({ state: "planned", reason: "noneQualified" });
      await expect(page.locator("#home-question")).toHaveText(
        plainText(answer.question),
      );
      await expect(page.locator("#home-answer")).toHaveText(
        plainText(answer.planned.noneQualified),
      );
      await expect(page.locator("#home-answer")).toHaveAttribute(
        "data-state",
        "planned",
      );
      await expect(page.locator("#home-control")).toHaveText(
        plainText(answer.control),
      );
      // No numbers until a selection is published.
      await expect(page.locator(".home-facts")).toHaveCount(0);
      await expect(page.locator("#home-answer")).not.toContainText(/\d/);

      for (const selector of [
        "#home-question",
        "#home-answer",
        "#home-control",
        '.home-answer a[href="/evals"]',
        '.home-answer a[href="/replay?mode=guided"]',
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

for (const language of LANGUAGES) {
  test(`opens every first-screen term by keyboard in ${language}`, async ({
    page,
  }) => {
    const answer = homeCopy[language].answer;
    await open(page, language);
    const terms = page.locator("main .home-term:visible");
    const count = await terms.count();
    expect(count).toBeGreaterThan(0);
    const opened = new Set<string>();
    for (let index = 0; index < count; index++) {
      const term = terms.nth(index);
      const key = (await term.getAttribute("popovertarget"))!;
      await term.focus();
      await page.keyboard.press("Enter");
      const note = page.locator(`#${key}`);
      await expect(note).toBeVisible();
      const name = key.replace("home-term-", "") as keyof typeof answer.terms;
      await expect(note).toContainText(answer.terms[name][1]);
      await page.keyboard.press("Escape");
      await expect(note).toBeHidden();
      await expect(term).toBeFocused();
      opened.add(name);
    }
    // Every explained term appears on the first screen in this state.
    for (const key of HOME_TERM_KEYS)
      if (!["primary", "escalation"].includes(key))
        expect([...opened], key).toContain(key);
  });
}

test.describe("on a touch screen", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test("opens and closes a term's explanation by tapping", async ({ page }) => {
    const answer = homeCopy.ko.answer;
    await open(page, "ko");
    await page.locator("#home-control .home-term").first().tap();
    const note = page.locator("#home-term-validator");
    await expect(note).toBeVisible();
    await expect(note).toContainText(answer.terms.validator[1]);
    await note.getByRole("button", { name: answer.close }).tap();
    await expect(note).toBeHidden();
  });
});

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
  test(`shows the four stages beside the answer at 1280x720 in ${language}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await open(page, language);
    await expect(page.locator(".home-flow li")).toHaveCount(4);
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
  for (const href of [
    "/",
    "/evals",
    "/replay",
    "/why",
    "/architecture",
    "/methodology",
    "/expectations",
    "/data-handling",
  ])
    await expect(panel.locator(`a[href="${href}"]`)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(button).toBeFocused();
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

test.describe("on the guided case at 1280x720", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("shows every committed source row in one table at step 1", async ({
    page,
  }) => {
    await page.addInitScript(() =>
      window.localStorage.setItem("weavetrail.language", "en"),
    );
    await page.goto("/replay");
    // The first table is the worked case; the separate mapping-review
    // example carries its own further down.
    const table = page.locator(".source-table").first();
    await expect(table).toBeVisible();
    const rows = table.locator("tbody tr");
    expect(await rows.count()).toBeGreaterThan(1);
    await expect(rows.first()).toBeInViewport();
    // Where the source comes from and its hash wait one disclosure below.
    await expect(
      page.locator(".source-provenance").first(),
    ).not.toHaveAttribute("open");
  });
});
