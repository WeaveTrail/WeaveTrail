import { expect, test, type Page } from "@playwright/test";

import { publishedExecutionFixProposal } from "../../../packages/scenarios/src/published-execution-schema";
import type { Language } from "../src/app/i18n/language";
import { mappingStep } from "../src/app/replay/steps/mapping";

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
  },
  ko: {
    approveMapping: "연결 제안 승인",
    approveCase: "조사 범위 승인",
    run: "분석 실행",
  },
} as const;

async function open(page: Page, language: Language) {
  await page.addInitScript((value) => {
    window.localStorage.setItem("weavetrail.language", value);
  }, language);
  await page.goto("/replay?mode=working");
  await expect(page.locator("html")).toHaveAttribute("lang", language);
}

/** Approves the worked case's mapping and case, then runs it. */
async function runWorkedCase(page: Page, language: Language) {
  const text = labels[language];
  await page
    .getByRole("button", { name: text.approveMapping, exact: true })
    .click();
  await expect(page.locator(".approval-coverage")).toHaveText(
    mappingStep.panel[language].coverage,
  );
  await page
    .getByRole("button", { name: text.approveCase, exact: true })
    .click();
  await page.getByRole("button", { name: text.run, exact: true }).click();
  await expect(page.locator(".gate-row")).toHaveCount(5);
}

/** The id the focused element carries, or the href of a focused link. */
const focused = (page: Page) =>
  page.evaluate(() => ({
    id: document.activeElement?.id ?? "",
    href: document.activeElement?.getAttribute("href") ?? "",
    className: document.activeElement?.className ?? "",
  }));

for (const viewport of VIEWPORTS) {
  for (const language of LANGUAGES) {
    test(`links every evidence line to its approved mapping row at ${viewport.width}x${viewport.height} in ${language}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await open(page, language);
      await runWorkedCase(page, language);

      // The approved mapping, row by row, is the committed proposal.
      const rows = page.locator(".approved-mapping-row");
      await expect(rows).toHaveCount(
        publishedExecutionFixProposal.fields.length,
      );
      for (const [
        index,
        field,
      ] of publishedExecutionFixProposal.fields.entries()) {
        const row = page.locator(`#approved-mapping-fields-${index}`);
        await expect(row).toHaveAttribute(
          "data-source-columns",
          field.sourceColumn,
        );
        await expect(row).toHaveAttribute(
          "data-target-field",
          field.targetField ?? "",
        );
        await expect(row).toHaveAttribute(
          "data-transform",
          field.transform ?? "",
        );
        await expect(row.locator(".trace-evidence")).toContainText(
          field.evidence,
        );
      }

      const gates = page.locator(".gate-row");
      for (let gate = 0; gate < 5; gate += 1) {
        const evidence = gates.nth(gate).locator("details.source-evidence");
        await evidence.locator("> summary").click();
        const lines = evidence.locator(".trace-line");
        expect(await lines.count()).toBeGreaterThan(0);
        for (const line of await lines.all()) {
          const key = await line.getAttribute("data-mapping-row");
          const link = line.locator(".trace-row-link");
          await expect(link).toHaveAttribute(
            "href",
            `#approved-mapping-${key}`,
          );
          const row = page.locator(`#approved-mapping-${key}`);
          await expect(row).toHaveCount(1);
          // The line names the target and transform its mapping row approved.
          await expect(line.locator(".trace-target")).toHaveText(
            (await row.locator(".trace-target").textContent()) ?? "",
          );
          // Every check the line names is one the mapping row links to.
          for (const href of await line
            .locator(".trace-check")
            .evaluateAll((links) => links.map((a) => a.getAttribute("href")))) {
            await expect(
              row.locator(`.trace-check[href="${href}"]`),
            ).toHaveCount(1);
          }
        }
        await evidence.locator("> summary").click();
      }

      // Every trace line and mapping row fits the viewport width.
      await page.locator(".approved-mapping > summary").click();
      for (const gate of await page
        .locator("details.source-evidence > summary")
        .all())
        await gate.click();
      expect(
        await page.evaluate(
          () =>
            Array.from(
              document.querySelectorAll(".trace-line, .approved-mapping-row"),
            ).filter(
              (element) =>
                element.getBoundingClientRect().right > window.innerWidth,
            ).length,
        ),
      ).toBe(0);
    });

    test(`follows a finding to its mapping row and back by keyboard at ${viewport.width}x${viewport.height} in ${language}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await open(page, language);
      await runWorkedCase(page, language);

      const gate = page.locator("#gate-PRICE_CHANGE");
      await gate.locator("details.source-evidence > summary").focus();
      await page.keyboard.press("Enter");
      await expect(gate.locator("details.source-evidence")).toHaveAttribute(
        "open",
        "",
      );

      // Tab forward to the first evidence line's mapping link.
      let toRow = "";
      for (let presses = 0; presses < 40 && !toRow; presses += 1) {
        await page.keyboard.press("Tab");
        const current = await focused(page);
        if (current.className.includes("trace-row-link")) toRow = current.href;
      }
      expect(toRow).toMatch(/^#approved-mapping-/);
      await page.keyboard.press("Enter");
      const row = page.locator(toRow);
      await expect(row).toBeFocused();
      await expect(row).toBeInViewport();

      // From the mapping row, the next Tab reaches its first check link.
      await page.keyboard.press("Tab");
      const back = await focused(page);
      expect(back.className).toContain("trace-check");
      expect(back.href).toBe("#gate-PRICE_CHANGE");
      expect(
        await page.evaluate(
          () =>
            document.activeElement?.closest(".approved-mapping-row")?.id ?? "",
        ),
      ).toBe(toRow.slice(1));
      await page.keyboard.press("Enter");
      await expect(gate).toBeFocused();
      await expect(gate).toBeInViewport();
    });
  }
}
