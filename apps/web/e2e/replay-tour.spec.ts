import { expect, test, type Page } from "@playwright/test";

import type { Language } from "../src/app/i18n/language";
import { tourCopy } from "../src/app/replay/tour/copy";

const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
] as const;
const LANGUAGES: readonly Language[] = ["en", "ko"];

async function open(page: Page, language: Language) {
  await page.addInitScript((value) => {
    window.localStorage.setItem("weavetrail.language", value);
  }, language);
  await page.goto("/replay");
  await expect(page.locator("html")).toHaveAttribute("lang", language);
}

/** The scene's heading has focus and sits inside the viewport. */
async function expectScene(page: Page, title: string) {
  const heading = page.locator("#tour-title");
  await expect(heading).toHaveText(title);
  await expect(heading).toBeFocused();
  await expect(heading).toBeInViewport();
}

for (const viewport of VIEWPORTS)
  for (const language of LANGUAGES)
    test(`walks the five scenes by keyboard at ${viewport.width}x${viewport.height} in ${language}`, async ({
      page,
    }) => {
      const text = tourCopy[language];
      await page.setViewportSize(viewport);
      await open(page, language);
      const action = (name: string) =>
        page.locator(".tour-actions").getByRole("button", { name });
      const press = async (name: string) => {
        await action(name).focus();
        await page.keyboard.press("Enter");
      };

      // 1 · The file as received, and what the walkthrough checks.
      await expect(page.locator("#tour-title")).toHaveText(
        text.scenes.source.title,
      );
      await expect(page.locator(".tour-goal")).toContainText(text.source.goal);
      await expect(page.locator(".tour-table tbody tr")).toHaveCount(6);
      await press(text.source.action);

      // 2 · The AI's matches; nothing runs before approval.
      await expectScene(page, text.scenes.mapping.title);
      await expect(page.locator(".tour-mapping tbody tr")).toHaveCount(7);
      await expect(page.locator(".tour-mapping")).toContainText(
        text.mapping.fields.price!,
      );
      await expect(page.locator(".tour-note").first()).toHaveText(
        text.mapping.prepared,
      );
      await press(text.mapping.action);

      // 3 · The scope in one sentence and the five criteria.
      await expectScene(page, text.scenes.scope.title);
      await expect(page.locator(".tour-scope")).toContainText("ZZ79X1");
      await expect(page.locator(".tour-criteria li")).toHaveCount(5);
      await press(text.scope.action);

      // 4 · The result, computed by the rules, then computed again.
      await expectScene(page, text.scenes.result.title);
      await press(text.result.run);
      const verdict = page.locator(".tour-verdict");
      await expect(verdict).toHaveAttribute("data-verdict", "SUPPORTED");
      await expect(verdict).toContainText(text.result.verdicts.SUPPORTED);
      await expect(page.locator(".tour-findings tbody tr")).toHaveCount(5);
      await page.getByRole("button", { name: text.result.repeat }).click();
      await expect(page.locator(".tour-repeat [role=status]")).toContainText(
        text.result.repeatSame,
      );
      await press(text.result.action);

      // 5 · Each criterion marks the source trades it used.
      await expectScene(page, text.scenes.evidence.title);
      const marked = page.locator('.tour-table tr[data-marked="true"]');
      expect(await marked.count()).toBeGreaterThan(0);
      await page.locator(".tour-pick label").nth(2).click();
      await expect(page.locator(".tour-used")).toHaveText(
        text.evidence.usedRows(await marked.count()),
      );
      await expect(
        page.locator('.tour-finish a[href="/replay?mode=working"]'),
      ).toBeVisible();

      // Nothing on the page scrolls sideways.
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBe(true);
    });

test("goes back to an earlier scene from the progress bar, never ahead", async ({
  page,
}) => {
  const text = tourCopy.en;
  await page.setViewportSize({ width: 1280, height: 720 });
  await open(page, "en");
  const step = (index: number) =>
    page.locator(".tour-progress li").nth(index).locator("button");
  // Scenes past the first unapproved one cannot be reached yet.
  await expect(step(2)).toBeDisabled();
  await page
    .locator(".tour-actions")
    .getByRole("button", { name: text.source.action })
    .click();
  await expect(step(2)).toBeDisabled();
  await step(0).click();
  await expect(page.locator("#tour-title")).toHaveText(
    text.scenes.source.title,
  );
});

test("keeps the approved case when handing off to hands-on mode, and starts over on return", async ({
  page,
}) => {
  const text = tourCopy.en;
  await page.setViewportSize({ width: 1280, height: 720 });
  await open(page, "en");
  const press = (name: string) =>
    page.locator(".tour-actions").getByRole("button", { name }).click();
  await press(text.source.action);
  await press(text.mapping.action);
  await expect(page.locator("#tour-title")).toHaveText(text.scenes.scope.title);
  await press(text.scope.action);
  await press(text.result.run);
  await expect(page.locator(".tour-verdict")).toHaveAttribute(
    "data-verdict",
    "SUPPORTED",
  );
  await press(text.result.action);

  // The hand-off keeps both approvals and the result.
  await page.locator('.tour-finish a[href="/replay?mode=working"]').click();
  await expect(page).toHaveURL(/mode=working/);
  await expect(page.locator(".approval-receipt")).toHaveCount(2);
  await expect(
    page.locator('.result-panel [data-result="SUPPORTED"]').first(),
  ).toBeVisible();

  // Coming back to the walkthrough restores the worked case unapproved.
  await page.locator('.mode-choice a[href="/replay?mode=guided"]').click();
  await expect(page.locator("#tour-title")).toHaveText(
    text.scenes.source.title,
  );
  await expect(
    page.locator(".tour-progress li").nth(2).locator("button"),
  ).toBeDisabled();
});
