import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  isValidElement,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CaseReplay,
  guideSteps,
  RapidPriceLiftEvaluation,
} from "./case-replay";
import { prepareReplayScenarios } from "./prepare-scenarios";
import { NavigationLinks } from "../site-navigation";

// The same persistent hook slots used by the lifecycle harness: this walks the
// element tree of the real component so step navigation, completion and the
// blocking condition are observed from actual state, not from a re-description.
const hooks = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as Array<() => void | (() => void)>,
}));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useRef(initial: unknown) {
      const index = hooks.cursor++;
      hooks.slots[index] ??= { current: initial };
      return hooks.slots[index];
    },
    useState(initial: unknown) {
      const index = hooks.cursor++;
      const slots = hooks.slots;
      if (!(index in slots)) slots[index] = initial;
      return [
        slots[index],
        (value: unknown) => {
          slots[index] =
            typeof value === "function" ? value(slots[index]) : value;
        },
      ];
    },
    useEffect(effect: () => void | (() => void), dependencies?: unknown[]) {
      const index = hooks.cursor++;
      const previous = hooks.slots[index] as
        { dependencies?: unknown[] } | undefined;
      const changed =
        dependencies === undefined ||
        previous?.dependencies === undefined ||
        dependencies.length !== previous.dependencies.length ||
        dependencies.some(
          (dependency, dependencyIndex) =>
            !Object.is(dependency, previous.dependencies![dependencyIndex]),
        );
      hooks.slots[index] = { dependencies };
      if (changed) hooks.effects.push(effect);
    },
  };
});

type ElementProps = {
  children?: ReactNode;
  onClick?: () => void | Promise<void>;
  onChange?: (event: { target: { value: string } }) => void;
  className?: string;
  disabled?: boolean;
  hidden?: boolean;
  href?: string;
  "aria-label"?: string;
  "aria-current"?: string;
  "data-complete"?: boolean;
  "data-met"?: boolean;
};

function elements(node: ReactNode): ReactElement<ElementProps>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function textContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (!isValidElement<ElementProps>(node)) return "";
  return textContent(node.props.children);
}

async function guide(guided = true) {
  const prepared = await prepareReplayScenarios();
  const slots: unknown[] = [];
  function render() {
    let rendered: ReactElement<ElementProps>[] = [];
    for (let pass = 0; pass < 10; pass += 1) {
      hooks.slots = slots;
      hooks.cursor = 0;
      hooks.effects = [];
      rendered = elements(CaseReplay({ ...prepared, guided }));
      const pending = hooks.effects;
      if (pending.length === 0) return rendered;
      pending.forEach((effect) => effect());
    }
    throw new Error("CaseReplay effects did not settle");
  }
  function indexOf(className: string) {
    return render().findIndex(
      (element) => element.props.className === className,
    );
  }
  function withClass(className: string) {
    return render().find((element) => element.props.className === className);
  }
  function button(label: string) {
    const element = render().find(
      (element) =>
        element.type === "button" && element.props.children === label,
    );
    if (!element?.props.onClick) throw new Error(`Missing button ${label}`);
    return element.props.onClick();
  }
  function stepButtons() {
    return render().filter(
      (element) => element.props.className === "journey-step",
    );
  }
  function openStep(step: number) {
    stepButtons()[step]!.props.onClick!();
  }
  function heading() {
    return textContent(
      render().find((element) => element.type === "h2")?.props.children,
    );
  }
  function intent() {
    const block = withClass("step-intent");
    return elements(block).filter((element) => element.type === "dd");
  }
  function requirement() {
    return withClass("step-requirement");
  }
  function nested() {
    return render().find((element) => element.type === CaseReplay);
  }
  return {
    render,
    prepared,
    indexOf,
    withClass,
    button,
    stepButtons,
    openStep,
    heading,
    intent,
    requirement,
    nested,
  };
}

async function approveExampleAndMapping(ui: Awaited<ReturnType<typeof guide>>) {
  await ui.button("Continue");
  const example = await nestedExample(ui);
  example.reason("Reviewed as intentionally unmapped.");
  await example.approve();
  await ui.button("Approve executed mapping");
}

async function nestedExample(ui: Awaited<ReturnType<typeof guide>>) {
  const element = ui.nested()!;
  const slots: unknown[] = [];
  const props = element.props as unknown as ComponentProps<typeof CaseReplay>;
  function render() {
    hooks.slots = slots;
    hooks.cursor = 0;
    hooks.effects = [];
    const rendered = elements(CaseReplay(props));
    hooks.effects.forEach((effect) => effect());
    return rendered;
  }
  return {
    reason(value: string) {
      render().find((element) => element.type === "input")!.props.onChange!({
        target: { value },
      });
    },
    approve() {
      return render().find(
        (element) =>
          element.type === "button" &&
          element.props.children === "Approve executed mapping",
      )!.props.onClick!();
    },
  };
}

// A response marker suffices: this file observes which control advances a step,
// not the evaluation itself.
function replayed() {
  return Response.json({
    workflowState: "REPLAYED",
    scenario: "rapid-price-lift-supported.csv",
    replay: {
      inputEventCount: 6,
      canonicalEventCount: 6,
      duplicateCount: 0,
      orderedEventIds: [],
      canonicalResultHash: "a".repeat(64),
    },
    evaluation: {},
    sourceTrace: { traceVersion: "1.0", entries: [] },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("guided step intent", () => {
  it("names one authority for every step", () => {
    expect(guideSteps).toHaveLength(7);
    for (const step of guideSteps) {
      expect([
        "Committed input",
        "A model proposed it",
        "A person approved it",
        "Versioned code decided it",
      ]).toContain(step.actor);
      expect(step.purpose.length).toBeGreaterThan(0);
      expect(step.action.length).toBeGreaterThan(0);
      expect(step.actorDetail.length).toBeGreaterThan(0);
    }
    expect(guideSteps.map(({ actor }) => actor)).toContain(
      "A model proposed it",
    );
    expect(guideSteps.map(({ actor }) => actor)).toContain(
      "A person approved it",
    );
    expect(guideSteps.map(({ actor }) => actor)).toContain(
      "Versioned code decided it",
    );
  });

  it("opens each step with its purpose, action and actor above the step content", async () => {
    const ui = await guide();
    for (const [step, expected] of guideSteps.entries()) {
      ui.openStep(step);
      expect(ui.heading()).toBe(`Step ${step + 1} · ${expected.title}`);
      const [purpose, action, actor] = ui.intent();
      expect(textContent(purpose)).toBe(expected.purpose);
      expect(textContent(action)).toBe(expected.action);
      expect(textContent(actor)).toBe(
        `${expected.actor} ${expected.actorDetail}`,
      );
      expect(ui.indexOf("step-intent")).toBeLessThan(
        ui.indexOf("replay-control panel"),
      );
    }
  });

  it("shows the unmet condition of the current step before any attempt", async () => {
    const ui = await guide();
    ui.openStep(1);
    expect(ui.requirement()!.props["data-met"]).toBe(false);
    expect(textContent(ui.requirement())).toContain(
      "Approve the separate mapping review example and this case's mapping to continue.",
    );
    expect(ui.indexOf("step-requirement")).toBeLessThan(
      ui.indexOf("replay-control panel"),
    );
  });

  it("names the earlier unmet step when the visitor reads ahead", async () => {
    const ui = await guide();
    ui.openStep(3);
    expect(ui.requirement()!.props["data-met"]).toBe(false);
    const text = textContent(ui.requirement());
    expect(text).toContain(
      "Not satisfied yet · Run the approved case and wait for its evaluation and source trace.",
    );
    expect(text).toContain(
      "you have not completed step 2 · Review the mapping",
    );
  });

  it("lets a visitor open an uncompleted step without reporting it as completed", async () => {
    const ui = await guide();
    ui.openStep(4);
    expect(ui.heading()).toBe("Step 5 · Inspect the finding");
    expect(ui.stepButtons()[4]!.props["data-complete"]).toBe(false);
    expect(textContent(ui.stepButtons()[4])).toContain("not completed");
    expect(ui.withClass("panel result-panel")!.props.hidden).toBe(false);
  });

  it("marks a step completed only while the visitor's own work still satisfies it", async () => {
    const ui = await guide();
    expect(ui.stepButtons().map((step) => step.props["data-complete"])).toEqual(
      Array.from(guideSteps, () => false),
    );
    await approveExampleAndMapping(ui);
    expect(ui.stepButtons()[0]!.props["data-complete"]).toBe(true);
    expect(ui.stepButtons()[1]!.props["data-complete"]).toBe(false);
    await ui.button("Continue");
    expect(ui.stepButtons()[1]!.props["data-complete"]).toBe(true);
    expect(textContent(ui.stepButtons()[1])).toContain("Completed by you");

    const example = await nestedExample(ui);
    example.reason("");
    expect(ui.stepButtons()[1]!.props["data-complete"]).toBe(false);
  });

  it("keeps a refusal on the path and states the condition that clears it", async () => {
    const ui = await guide();
    ui.openStep(1);
    const refusal = textContent(ui.withClass("step-refusal"));
    expect(refusal).toContain("REVIEW_REQUIRED");
    expect(refusal).toContain(
      "A nonblank reviewer reason on every flagged field is the condition that clears it.",
    );
  });

  it("repeats the step controls above and below the step content", async () => {
    const ui = await guide();
    const navigation = ui
      .render()
      .filter((element) => element.props.className === "journey-controls");
    expect(navigation.map((element) => element.props["aria-label"])).toEqual([
      "Step navigation in the step rail",
      "Step navigation at the end of the step",
    ]);
    const content = ui.indexOf("replay-control panel");
    expect(ui.indexOf("journey-controls")).toBeLessThan(content);
    expect(
      ui
        .render()
        .map((element) => element.props.className)
        .lastIndexOf("journey-controls"),
    ).toBeGreaterThan(content);
    const advance = ui
      .render()
      .filter(
        (element) =>
          element.type === "button" && element.props.children === "Continue",
      );
    expect(advance).toHaveLength(2);
    expect(advance[0]!.props.disabled).toBe(advance[1]!.props.disabled);
  });

  it("distinguishes the control that advances the current step", async () => {
    const ui = await guide();
    const marked = () =>
      ui
        .render()
        .filter((element) => element.props.className?.includes("step-action"))
        .map((element) => textContent(element.props.children));
    expect(marked()).toEqual([]);
    ui.openStep(1);
    expect(marked()).toEqual(["Approve executed mapping"]);
    ui.openStep(2);
    expect(marked()).toEqual(["Approve case manifest"]);
    ui.openStep(3);
    expect(marked()).toEqual(["Run deterministic replay"]);
    ui.openStep(4);
    expect(marked()).toEqual([]);
    expect(
      ui.render().find((element) => element.props.className === "empty-result"),
    ).toBeDefined();
    ui.openStep(6);
    expect(marked()).toEqual(["Continue in Case Replay"]);
  });

  it("marks the finding disclosure as the control that advances inspection", async () => {
    const ui = await guide();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(replayed()));
    await approveExampleAndMapping(ui);
    await ui.button("Continue");
    await ui.button("Approve case manifest");
    await ui.button("Continue");
    await ui.button("Run deterministic replay");
    await ui.button("Continue");

    const disclosure = () =>
      ui.render().find((element) => element.type === RapidPriceLiftEvaluation)!
        .props as unknown as ComponentProps<typeof RapidPriceLiftEvaluation>;
    expect(ui.heading()).toBe("Step 5 · Inspect the finding");
    expect(disclosure().advancesStep).toBe(true);
    disclosure().onEvidenceOpen!();
    expect(disclosure().advancesStep).toBe(false);
    expect(ui.requirement()!.props["data-met"]).toBe(true);
  });

  it("marks the guided entry current only while the guided query is set", () => {
    const marked = (current: string | null) =>
      elements(NavigationLinks({ current }))
        .filter((element) => element.props["aria-current"] === "page")
        .map((element) => element.props.href);
    expect(marked("/replay?mode=guided")).toEqual(["/replay?mode=guided"]);
    expect(marked("/replay")).toEqual(["/replay"]);
    expect(marked(null)).toEqual([]);
  });

  it("offers the guided case from the navigation and above the working controls", async () => {
    const navigation = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/site-navigation.tsx"),
      "utf8",
    );
    expect(navigation).toContain('["Guided case", "/replay?mode=guided"]');

    const working = await guide(false);
    const offer = working.withClass("guided-offer");
    expect(offer).toBeDefined();
    expect(
      elements(offer).find((element) => element.props.href)!.props.href,
    ).toBe("/replay?mode=guided");
    expect(working.indexOf("guided-offer")).toBeLessThan(
      working.indexOf("replay-control panel"),
    );
    expect(working.withClass("journey-progress")).toBeUndefined();
  });
});
