import { expect, test, type Page } from "@playwright/test";

import { PANEL_KEYS } from "../src/app/evals/model-comparison-copy";
import { modelComparisonCopy } from "../src/app/evals/model-comparison-copy";
import { DECLARED_MODELS } from "../src/app/evals/model-comparison-data";
import { percent } from "../src/app/evals/model-comparison-data";
import { committedHeldOutResult } from "../src/app/evals/held-out-result";
import type { Language } from "../src/app/i18n/language";

const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
] as const;
const LANGUAGES: readonly Language[] = ["en", "ko"];

async function open(page: Page, language: Language, path = "/evals") {
  await page.addInitScript((value) => {
    window.localStorage.setItem("weavetrail.language", value);
  }, language);
  await page.goto(path);
  await expect(page.locator("html")).toHaveAttribute("lang", language);
}

/** The element's whole box lies inside the first viewport, unscrolled. */
async function expectInFirstViewport(page: Page, selector: string) {
  const viewport = page.viewportSize()!;
  const boxes = await page.locator(selector).evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom };
    }),
  );
  expect(boxes.length, selector).toBeGreaterThan(0);
  for (const box of boxes) {
    expect(box.top, selector).toBeGreaterThanOrEqual(0);
    expect(box.bottom, selector).toBeLessThanOrEqual(viewport.height);
  }
}

for (const viewport of VIEWPORTS) {
  for (const language of LANGUAGES) {
    test(`answers the selection question in the first ${viewport.width}x${viewport.height} viewport in ${language}`, async ({
      page,
    }) => {
      const copy = modelComparisonCopy[language];
      await page.setViewportSize(viewport);
      await open(page, language);

      await expect(page.locator("#model-comparison-answer")).toHaveText(
        copy.answer.noModel,
      );
      await expect(page.locator('[data-role="primary"]')).toHaveText(
        copy.roleValue.noModel,
      );
      await expect(page.locator('[data-role="escalation"]')).toHaveText(
        copy.roleValue.noModel,
      );
      const rows = page.locator(".mc-eligibility tbody tr");
      await expect(rows).toHaveCount(DECLARED_MODELS.length + 1);
      const models = committedHeldOutResult.comparison.groups.filter(
        (g) => g.role === "MODEL",
      );
      for (const [index, group] of models.entries()) {
        const row = rows.nth(index);
        await expect(row.locator("th")).toContainText(
          group.identity.requestedModel,
        );
        await expect(row).toHaveAttribute("data-eligible", "false");
        await expect(row).toContainText(percent(group.byTag.ALL!.validOutput)!);
      }
      await expect(page.locator("#mc-eligibility-caption")).toHaveText(
        copy.caption.run(committedHeldOutResult.runDate),
      );
      await expect(page.locator(".mc-reference th")).toContainText(
        copy.referenceName,
      );

      await expectInFirstViewport(page, "#model-comparison-answer");
      await expectInFirstViewport(page, ".mc-roles");
      await expectInFirstViewport(page, "#mc-eligibility-caption");
      await expectInFirstViewport(page, ".mc-eligibility thead tr");
      await expectInFirstViewport(page, ".mc-eligibility tbody tr");
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
    });
  }
}

test("moves through every panel with the keyboard alone and never reloads", async ({
  page,
}) => {
  // History API updates are same-document navigations; only a load is a reload.
  let loads = 0;
  page.on("load", () => loads++);
  await open(page, "en");
  await page.evaluate(() => {
    (window as unknown as { loaded: number }).loaded = 1;
  });
  const before = loads;
  const copy = modelComparisonCopy.en;

  // Tab from the top of the document until the selected tab has focus.
  await page.locator("body").focus();
  for (let presses = 0; presses < 80; presses++) {
    await page.keyboard.press("Tab");
    if (
      await page.evaluate(
        () => document.activeElement?.getAttribute("role") === "tab",
      )
    )
      break;
  }
  await expect(
    page.getByRole("tab", { name: copy.panels.chart }),
  ).toBeFocused();

  for (const key of PANEL_KEYS.slice(1)) {
    await page.keyboard.press("ArrowRight");
    const tab = page.getByRole("tab", { name: copy.panels[key] });
    await expect(tab).toBeFocused();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(`#mc-panel-${key}`)).toBeVisible();
    expect(new URL(page.url()).searchParams.get("view")).toBe(key);
  }
  await page.keyboard.press("Home");
  await expect(page.locator("#mc-panel-chart")).toBeVisible();

  // A term in the table header opens its plain explanation by keyboard.
  await page
    .getByRole("link", { name: copy.columns.overAbstention, exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#mc-panel-terms")).toBeVisible();
  await expect(page.locator("#term-overAbstention")).toBeFocused();

  expect(loads).toBe(before);
  expect(
    await page.evaluate(
      () => (window as unknown as { loaded?: number }).loaded,
    ),
  ).toBe(1);
});

test("restores the open panel from the URL", async ({ page }) => {
  await open(page, "ko", "/evals?view=rule");
  await expect(
    page.getByRole("tab", { name: modelComparisonCopy.ko.panels.rule }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#mc-panel-rule")).toBeVisible();
  await expect(page.locator("#mc-panel-chart")).toBeHidden();
});

test("a term link's own URL opens its explanation", async ({ page }) => {
  await open(page, "en");
  const href = await page
    .getByRole("link", {
      name: modelComparisonCopy.en.columns.overAbstention,
      exact: true,
    })
    .getAttribute("href");
  expect(href).toBe("?view=terms#term-overAbstention");
  await page.goto(`/evals${href}`);
  await expect(page.locator("#mc-panel-terms")).toBeVisible();
  await expect(page.locator("#term-overAbstention")).toBeVisible();
});

test("loads nothing from outside the site", async ({ page, baseURL }) => {
  const foreign: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith(baseURL!) && !url.startsWith("data:"))
      foreign.push(url);
  });
  await open(page, "en");
  for (const key of PANEL_KEYS) {
    await page
      .getByRole("tab", { name: modelComparisonCopy.en.panels[key] })
      .click();
    await expect(page.locator(`#mc-panel-${key}`)).toBeVisible();
  }
  expect(foreign).toEqual([]);
});
