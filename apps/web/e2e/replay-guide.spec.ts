import { expect, test, type Page } from "@playwright/test";

import type { Language } from "../src/app/i18n/language";
import {
  GUIDE_STAGES,
  guideStageNames,
  guideStepsByLanguage,
  guideUi,
} from "../src/app/replay/case-replay";

const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
] as const;
const LANGUAGES: readonly Language[] = ["en", "ko"];

const labels = {
  en: {
    approveMapping: "Approve executed mapping",
    approveCase: "Approve case manifest",
    run: "Run deterministic replay",
    repeat: "Repeat the same approved case",
    workingMode: "Continue in working mode",
  },
  ko: {
    approveMapping: "연결 제안 승인",
    approveCase: "조사 범위 승인",
    run: "분석 실행",
    repeat: "같은 사례 다시 실행",
    workingMode: "직접 조작으로 이동",
  },
} as const;

async function open(page: Page, language: Language) {
  await page.addInitScript((value) => {
    window.localStorage.setItem("weavetrail.language", value);
  }, language);
  await page.goto("/replay?mode=guided");
  await expect(page.locator("html")).toHaveAttribute("lang", language);
}

/** What the focused element is, in terms the walk below can match on. */
const focused = (page: Page) =>
  page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    return {
      tag: element?.tagName.toLowerCase() ?? "",
      text: element?.textContent?.trim() ?? "",
      disabled: element?.matches(":disabled") ?? false,
      unresolved: element?.getAttribute("data-review-unresolved") === "true",
      inExample: element?.closest(".mapping-example") !== null,
    };
  });

/** Presses Tab from the current focus until a button labelled `label` that
 *  can be acted on has focus, then presses Enter on it. */
async function pressButton(page: Page, label: string) {
  for (let presses = 0; presses < 400; presses++) {
    const current = await focused(page);
    if (current.tag === "button" && current.text === label && !current.disabled)
      return page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
  }
  throw new Error(`no enabled button labelled ${label} reachable by Tab`);
}

/** The current step's stage sits wholly inside the viewport, unscrolled by
 *  the test, and names the stage the step table puts it in. */
async function expectStageInView(page: Page, language: Language, step: number) {
  const expected = guideStepsByLanguage[language][step]!;
  const stage = page.locator("#guide-stage");
  await expect(stage).toHaveAttribute("data-stage", expected.stage);
  await expect(stage).toContainText(guideStageNames[language][expected.stage]);
  if (!expected.afterMainFlow)
    await expect(stage).toContainText(
      guideUi[language].stageOf(
        GUIDE_STAGES.indexOf(expected.stage) + 1,
        GUIDE_STAGES.length,
      ),
    );
  const viewport = page.viewportSize()!;
  const box = await stage.boundingBox();
  expect(box, `stage of step ${step + 1}`).not.toBeNull();
  expect(box!.y, `stage of step ${step + 1}`).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height, `stage of step ${step + 1}`).toBeLessThanOrEqual(
    viewport.height,
  );
}

async function expectStep(page: Page, language: Language, step: number) {
  await expect(page.locator(".journey-header h2")).toHaveText(
    guideUi[language].stepHeading(
      step + 1,
      guideStepsByLanguage[language][step]!.title,
    ),
  );
  await expectStageInView(page, language, step);
}

for (const viewport of VIEWPORTS) {
  for (const language of LANGUAGES) {
    test(`walks the four stages by keyboard alone at ${viewport.width}x${viewport.height} in ${language}`, async ({
      page,
    }) => {
      const text = labels[language];
      const ui = guideUi[language];
      await page.setViewportSize(viewport);
      await open(page, language);
      await expect(page.locator(".journey-step")).toHaveCount(8);
      await page.locator("body").focus();

      // AI proposes: the source, then the worked case's own mapping.
      await expectStep(page, language, 0);
      await expect(page.locator("[data-approved='true']")).toHaveCount(0);
      await pressButton(page, ui.continueLabel);
      await expectStep(page, language, 1);
      await expect(
        page.locator(".journey-header .rail-actions").getByRole("button", {
          name: ui.continueLabel,
        }),
      ).toBeDisabled();
      await pressButton(page, text.approveMapping);
      await expect(page.locator(".approval-coverage")).toBeVisible();
      await pressButton(page, ui.continueLabel);

      // A person approves the case.
      await expectStep(page, language, 2);
      await pressButton(page, text.approveCase);
      await pressButton(page, ui.continueLabel);

      // Code verifies: the worked case runs without the example's approval.
      await expectStep(page, language, 3);
      await expect(
        page.locator(".mapping-example .approval-receipt"),
      ).toHaveCount(0);
      await pressButton(page, text.run);
      await expect(
        page.locator(".replay-control .workflow-state code"),
      ).toHaveText("REPLAYED");
      await pressButton(page, ui.continueLabel);
      await expectStep(page, language, 4);
      await pressButton(page, text.repeat);
      await expect(
        page.getByText(
          language === "en"
            ? "MATCH · same-input repeatability"
            : "일치 · 같은 입력 반복 가능",
        ),
      ).toBeVisible();
      await pressButton(page, ui.continueLabel);

      // Evidence traces back: the verdict and its tally lead the result, and
      // the machine values wait in one closed disclosure.
      await expectStep(page, language, 5);
      await expect(page.locator(".result-tally")).toBeVisible();
      await expect(page.locator(".result-technical")).not.toHaveAttribute(
        "open",
        "",
      );
      // The rail goes to the disclosure; Enter opens it.
      await pressButton(page, ui.goToEvidence);
      await expect.poll(async () => (await focused(page)).tag).toBe("summary");
      await page.keyboard.press("Enter");
      await expect(page.locator(".source-evidence").first()).toHaveAttribute(
        "open",
        "",
      );
      await pressButton(page, ui.continueLabel);

      // After the worked case: the separate example opens by saying its
      // approval does not authorize the case, and blocks until every flagged
      // field has a reason.
      await expectStep(page, language, 6);
      const example = page.locator(".mapping-example");
      await expect(example.locator(".mapping-example-scope")).toContainText(
        language === "en"
          ? "This approval does not authorize the worked case."
          : "여기서 한 승인은 지금 따라온 사례에 적용되지 않습니다.",
      );
      // By class: its label changes once it is approved.
      const approveExample = example.locator("button.approve-mapping");
      const railContinue = page
        .locator(".journey-header .rail-actions")
        .getByRole("button", { name: ui.continueLabel });
      const flagged = example.locator("input[data-review-unresolved]");
      const flaggedCount = await flagged.count();
      expect(flaggedCount).toBeGreaterThan(0);
      await expect(approveExample).toBeDisabled();
      await expect(railContinue).toBeDisabled();
      await expect(example.getByText("REVIEW_REQUIRED").first()).toBeVisible();

      await pressButton(page, ui.goToExample);
      for (let given = 0; given < flaggedCount; given++) {
        let current = await focused(page);
        for (let presses = 0; !current.unresolved && presses < 40; presses++) {
          await page.keyboard.press("Tab");
          current = await focused(page);
        }
        expect(current.unresolved && current.inExample).toBe(true);
        if (given < flaggedCount - 1)
          await expect(approveExample).toBeDisabled();
        await page.keyboard.type("Reviewed as intentionally unmapped.");
      }
      await expect(approveExample).toBeEnabled();
      await expect(railContinue).toBeDisabled();
      await pressButton(page, text.approveMapping);
      await expect(approveExample).toHaveAttribute("data-approved", "true");
      await pressButton(page, ui.continueLabel);

      // The hand-off completes the guide.
      await expectStep(page, language, 7);
      await pressButton(page, text.workingMode);
      await expect(page).toHaveURL(/mode=working/);
    });
  }
}

test("does not satisfy the evidence step by printing", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await open(page, "en");
  const rail = page.locator(".journey-header .rail-actions");
  const railContinue = rail.getByRole("button", { name: "Continue" });
  const press = async (name: string) =>
    rail.getByRole("button", { name, exact: true }).click();
  await railContinue.click();
  await press(labels.en.approveMapping);
  await railContinue.click();
  await press(labels.en.approveCase);
  await railContinue.click();
  await press(labels.en.run);
  await expect(railContinue).toBeEnabled();
  await railContinue.click();
  await press(labels.en.repeat);
  await expect(railContinue).toBeEnabled();
  await railContinue.click();
  await expect(page.locator(".journey-header h2")).toHaveText(
    guideUi.en.stepHeading(6, guideStepsByLanguage.en[5]!.title),
  );
  await expect(railContinue).toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
  await expect(page.locator(".source-evidence").first()).toHaveAttribute(
    "open",
    "",
  );
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await expect(page.locator(".source-evidence").first()).not.toHaveAttribute(
    "open",
    "",
  );
  await expect(railContinue).toBeDisabled();
});
