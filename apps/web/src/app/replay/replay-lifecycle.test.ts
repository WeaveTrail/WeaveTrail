import {
  isValidElement,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { committedReplayScenarios } from "@weavetrail/scenarios";
import {
  CaseReplay,
  ApprovalReceipt,
  RapidPriceLiftEvaluation,
  type ReplayScenarioOption,
} from "./case-replay";
import { prepareReplayScenarios } from "./prepare-scenarios";
import * as rowShuffle from "./shuffle-source-rows";
import type { ReplayRequest } from "@weavetrail/contracts";

// Exercise the actual CaseReplay handlers with persistent hook slots. This is a
// component-state regression harness, not a browser/hydration assertion.
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
  value?: string;
  name?: string;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
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
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const first = "rapid-price-lift-supported.csv";
const second = "rapid-price-lift-insufficient-evidence.csv";
function setup(overrides: Partial<ComponentProps<typeof CaseReplay>> = {}) {
  const slots: unknown[] = [];
  let currentOverrides = overrides;
  const scenarios: ReplayScenarioOption[] = [first, second].map((value) => {
    const fixture =
      committedReplayScenarios[value as typeof first | typeof second];
    const { approval: _, ...manifest } = fixture.manifest;
    void _;
    return {
      value: value as ReplayScenarioOption["value"],
      label: fixture.label,
      sourceArtifactHash: fixture.sourceArtifactHash,
      rows: fixture.rows,
      manifest,
    };
  });
  const proposals = Object.fromEntries(
    [first, second].map((value) => {
      const fixture =
        committedReplayScenarios[value as typeof first | typeof second];
      return [fixture.sourceArtifactHash, fixture.mappingProposal];
    }),
  );
  function render() {
    let rendered: ReactElement<ElementProps>[] = [];
    for (let pass = 0; pass < 10; pass += 1) {
      hooks.slots = slots;
      hooks.cursor = 0;
      hooks.effects = [];
      rendered = elements(
        CaseReplay({
          proposals,
          scenarios,
          providerMode: "fixture",
          ...currentOverrides,
        }),
      );
      const pendingEffects = hooks.effects;
      if (pendingEffects.length === 0) return rendered;
      pendingEffects.forEach((effect) => effect());
    }
    throw new Error("CaseReplay effects did not settle");
  }
  function button(label: string) {
    const element = render().find(
      (element) =>
        element.type === "button" && element.props.children === label,
    );
    if (!element?.props.onClick) throw new Error(`Missing button ${label}`);
    return element.props.onClick();
  }
  function changeScenario(value = second) {
    render().find((element) => element.type === "select")!.props.onChange!({
      target: { value },
    });
  }
  function changeMutation(value: string) {
    render().find(
      (element) =>
        element.props.name === "mutation" && element.props.value === value,
    )!.props.onChange!({ target: { value } });
  }
  function submittedOrder() {
    const section = render().find(
      (element) => element.props["aria-label"] === "Submitted source row order",
    );
    return section
      ? textContent(
          elements(section).find((element) => element.type === "code")?.props
            .children,
        )
      : null;
  }
  function evidence() {
    return render().filter(
      (element) => element.type === RapidPriceLiftEvaluation,
    );
  }
  async function approve() {
    await button("Approve executed mapping");
    await button("Approve case manifest");
  }
  function setGuided(guided: boolean) {
    currentOverrides = { ...currentOverrides, guided };
    render();
  }
  function buttonDisabled(label: string) {
    return render().find(
      (element) =>
        element.type === "button" && element.props.children === label,
    )?.props.disabled;
  }
  function hasText(text: string) {
    return render().some((element) =>
      textContent(element.props.children).includes(text),
    );
  }
  return {
    render,
    button,
    buttonDisabled,
    changeScenario,
    changeMutation,
    submittedOrder,
    evidence,
    approve,
    hasText,
    setGuided,
  };
}
// A response marker suffices here: provenance correctness is covered by API and
// disclosure tests. The state harness only observes whether the view survives.
const result = {
  workflowState: "REPLAYED",
  scenario: first,
  replay: {
    inputEventCount: 6,
    canonicalEventCount: 6,
    duplicateCount: 0,
    orderedEventIds: [],
    canonicalResultHash: "a".repeat(64),
  },
  evaluation: {},
  sourceTrace: { traceVersion: "1.0", entries: [] },
};
function ok(hash = "a".repeat(64)) {
  return Response.json({
    ...result,
    replay: { ...result.replay, canonicalResultHash: hash },
  });
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function advanceGuidedToRepeat(guide: ReturnType<typeof setup>) {
  await guide.button("Continue");
  const exampleElement = guide
    .render()
    .find((element) => element.type === CaseReplay)!;
  const example = setup(
    exampleElement.props as ComponentProps<typeof CaseReplay>,
  );
  example.render().find((element) => element.type === "input")!.props.onChange!(
    {
      target: { value: "Reviewed as intentionally unmapped." },
    },
  );
  await example.button("Approve executed mapping");
  await guide.button("Approve executed mapping");
  await guide.button("Continue");
  await guide.button("Approve case manifest");
  await guide.button("Continue");
  await guide.button("Run deterministic replay");
  await guide.button("Continue");
  const evaluation = guide.evidence()[0]!.props as ComponentProps<
    typeof RapidPriceLiftEvaluation
  >;
  evaluation.onEvidenceOpen!();
  await guide.button("Continue");
}

describe("replay result lifecycle", () => {
  it("submits varying source orders, displays the exact request and retains explicit approvals", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const ui = setup();
    const request = vi.fn().mockImplementation(() => Promise.resolve(ok()));
    vi.stubGlobal("fetch", request);
    await ui.approve();
    const committed = structuredClone(committedReplayScenarios[first].rows);
    const bodies = () =>
      request.mock.calls.map(
        ([, init]) => JSON.parse(init.body) as ReplayRequest,
      );
    await ui.button("Run deterministic replay");
    const baseline = bodies()[0]!;
    ui.changeMutation("shuffle");
    expect(ui.submittedOrder()).toBeNull();
    for (let run = 0; run < 2; run += 1) {
      await ui.button("Run deterministic replay");
      const submitted = bodies().at(-1)!;
      expect(submitted.mutation).toBe("shuffle");
      expect(submitted.rows).not.toEqual(bodies().at(-2)!.rows);
      expect(new Set(submitted.rows.map((row) => JSON.stringify(row)))).toEqual(
        new Set(committed.map((row) => JSON.stringify(row))),
      );
      expect(ui.submittedOrder()).toBe(
        submitted.rows.map((row) => row.coordinate.rowNumber).join(" → "),
      );
      expect(submitted.mappingApproval).toEqual(baseline.mappingApproval);
      expect(submitted.caseManifest).toEqual(baseline.caseManifest);
    }
    await ui.button("Repeat the same approved case");
    expect(bodies().at(-1)).toEqual(bodies().at(-2));
    for (const mutation of ["duplicate", "baseline"]) {
      ui.changeMutation(mutation);
      await ui.button("Run deterministic replay");
      expect(bodies().at(-1)!.rows).toEqual(committed);
      expect(ui.submittedOrder()).toBe(
        committed.map((row) => row.coordinate.rowNumber).join(" → "),
      );
    }
    expect(committedReplayScenarios[first].rows).toEqual(committed);
  });

  it.each(["scenario", "guided re-entry"])(
    "resets submitted order history on %s",
    async (change) => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const shuffle = vi.spyOn(rowShuffle, "shuffleSourceRows");
      const ui = setup();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(() => Promise.resolve(ok())),
      );
      await ui.approve();
      ui.changeMutation("shuffle");
      await ui.button("Run deterministic replay");
      expect(ui.submittedOrder()).not.toBeNull();
      if (change === "scenario") {
        ui.changeScenario();
        ui.changeScenario(first);
      } else {
        ui.setGuided(true);
        ui.setGuided(false);
      }
      expect(ui.submittedOrder()).toBeNull();
      await ui.approve();
      ui.changeMutation("shuffle");
      await ui.button("Run deterministic replay");
      expect(shuffle.mock.calls.at(-1)![1]).toEqual(
        committedReplayScenarios[first].rows,
      );
    },
  );

  it.each(["mutation", "scenario", "guided re-entry"])(
    "keeps stale responses from restoring submitted order after %s",
    async (change) => {
      const ui = setup();
      await ui.approve();
      ui.changeMutation("shuffle");
      const pending = deferred<Response>();
      vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending.promise));
      const run = ui.button("Run deterministic replay");
      expect(ui.submittedOrder()).not.toBeNull();
      if (change === "mutation") ui.changeMutation("baseline");
      else if (change === "scenario") ui.changeScenario();
      else ui.setGuided(true);
      expect(ui.submittedOrder()).toBeNull();
      pending.resolve(ok());
      await run;
      expect(ui.submittedOrder()).toBeNull();
      expect(ui.evidence()).toHaveLength(0);
      expect(ui.hasText("Previous returned hash")).toBe(false);
    },
  );
  it("describes threshold values as proposed and then approved case configuration", async () => {
    const prepared = await prepareReplayScenarios();
    const guide = setup({ ...prepared, guided: true });
    await guide.button("Continue");
    const exampleElement = guide
      .render()
      .find((element) => element.type === CaseReplay)!;
    const example = setup(
      exampleElement.props as ComponentProps<typeof CaseReplay>,
    );
    example.render().find((element) => element.type === "input")!.props
      .onChange!({ target: { value: "Reviewed as intentionally unmapped." } });
    await example.button("Approve executed mapping");
    await guide.button("Approve executed mapping");
    await guide.button("Continue");

    expect(
      guide.hasText(
        "Review and approve the exact scope and threshold values proposed in this committed, authored case.",
      ),
    ).toBe(true);
    expect(
      guide.hasText("Threshold values proposed in this authored case."),
    ).toBe(true);
    expect(
      guide.hasText(
        "Versioned code defines the allowed parameter schema, formulas and comparisons.",
      ),
    ).toBe(true);

    await guide.button("Approve case manifest");
    expect(guide.hasText("Threshold values approved with this case.")).toBe(
      true,
    );
  });

  it("accepts only a repeat that matches the original returned hash", async () => {
    const shuffle = vi.spyOn(rowShuffle, "shuffleSourceRows");
    const prepared = await prepareReplayScenarios();
    const guide = setup({ ...prepared, guided: true });
    const request = vi
      .fn()
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(ok("b".repeat(64)))
      .mockResolvedValueOnce(ok("b".repeat(64)))
      .mockResolvedValueOnce(ok());
    vi.stubGlobal("fetch", request);

    await advanceGuidedToRepeat(guide);
    expect(guide.buttonDisabled("Continue")).toBe(true);
    await guide.button("Repeat the same approved case");
    expect(
      guide.hasText("MISMATCH · retry or inspect the returned results"),
    ).toBe(true);
    expect(guide.buttonDisabled("Continue")).toBe(true);
    expect(guide.buttonDisabled("Continue in Case Replay")).toBe(true);

    // A second B must still compare with the original A baseline.
    await guide.button("Repeat the same approved case");
    expect(guide.buttonDisabled("Continue")).toBe(true);
    expect(guide.buttonDisabled("Continue in Case Replay")).toBe(true);

    // Returning to A recovers both completion gates.
    await guide.button("Repeat the same approved case");
    expect(guide.hasText("MATCH · same-input repeatability")).toBe(true);
    expect(guide.buttonDisabled("Continue")).toBe(false);
    expect(guide.buttonDisabled("Continue in Case Replay")).toBe(false);
    expect(
      request.mock.calls
        .map(([, init]) => JSON.stringify(JSON.parse(init.body)))
        .every(
          (body) =>
            body === JSON.stringify(JSON.parse(request.mock.calls[0]![1].body)),
        ),
    ).toBe(true);
    expect(shuffle).not.toHaveBeenCalled();
  });

  it("accepts an immediate A to A repeat", async () => {
    const prepared = await prepareReplayScenarios();
    const guide = setup({ ...prepared, guided: true });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(ok()).mockResolvedValueOnce(ok()),
    );

    await advanceGuidedToRepeat(guide);
    await guide.button("Repeat the same approved case");
    expect(guide.hasText("MATCH · same-input repeatability")).toBe(true);
    expect(guide.buttonDisabled("Continue")).toBe(false);
    expect(guide.buttonDisabled("Continue in Case Replay")).toBe(false);
  });

  it("requires an evaluated result, source inspection and a real repeat before retaining state in working mode", async () => {
    const prepared = await prepareReplayScenarios();
    const completeGuide = vi.fn();
    const guide = setup({
      ...prepared,
      guided: true,
      onGuideComplete: completeGuide,
    });
    const progressBlocked = () =>
      guide
        .render()
        .find(
          (element) =>
            element.type === "button" && element.props.children === "Continue",
        )!.props.disabled;
    await guide.button("Continue");
    const exampleElement = guide
      .render()
      .find((element) => element.type === CaseReplay)!;
    const example = setup(
      exampleElement.props as ComponentProps<typeof CaseReplay>,
    );
    example.render().find((element) => element.type === "input")!.props
      .onChange!({ target: { value: "Reviewed as intentionally unmapped." } });
    await example.button("Approve executed mapping");
    await guide.button("Approve executed mapping");
    await guide.button("Continue");
    await guide.button("Approve case manifest");
    await guide.button("Continue");
    const foundation = {
      ...result,
      workflowState: "MAPPING_APPROVED",
      evaluation: undefined,
      sourceTrace: undefined,
    };
    const request = vi
      .fn()
      .mockResolvedValueOnce(Response.json(foundation))
      .mockResolvedValueOnce(ok())
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce(ok());
    vi.stubGlobal("fetch", request);
    await guide.button("Run deterministic replay");
    expect(progressBlocked()).toBe(true);
    await guide.button("Continue");
    expect(progressBlocked()).toBe(true);
    await guide.button("Run deterministic replay");
    expect(progressBlocked()).toBe(false);
    await guide.button("Continue");
    expect(progressBlocked()).toBe(true);
    const evaluation = guide.evidence()[0]!.props as ComponentProps<
      typeof RapidPriceLiftEvaluation
    >;
    evaluation.onEvidenceOpen!();
    expect(progressBlocked()).toBe(false);
    await guide.button("Continue");
    expect(progressBlocked()).toBe(true);
    await guide.button("Repeat the same approved case");
    expect(progressBlocked()).toBe(true);
    expect(
      guide
        .render()
        .find(
          (element) =>
            element.type === "button" &&
            element.props.children === "Repeat the same approved case",
        )!.props.disabled,
    ).toBe(false);
    // A failed attempt is not completion; the same approved input can be retried.
    expect(guide.evidence()).toHaveLength(0);
    await guide.button("Repeat the same approved case");
    expect(progressBlocked()).toBe(false);
    const bodies = request.mock.calls.map(([, init]) => JSON.parse(init.body));
    expect(
      bodies.every(
        (body) => JSON.stringify(body) === JSON.stringify(bodies[0]),
      ),
    ).toBe(true);
    await guide.button("Continue");
    await guide.button("Continue in Case Replay");
    expect(completeGuide).toHaveBeenCalledOnce();
    guide.setGuided(false);
    expect(
      guide.render().filter((element) => element.type === ApprovalReceipt),
    ).toHaveLength(2);
    expect(guide.evidence()).toHaveLength(1);
    expect(
      guide.render().find((element) => element.type === "select")!.props.value,
    ).toBe(first);
    guide.changeScenario();
    expect(guide.evidence()).toHaveLength(0);
    expect(
      guide.render().filter((element) => element.type === ApprovalReceipt),
    ).toHaveLength(0);
  });
  it("refuses direct handlers without explicit mapping and case approvals", async () => {
    const ui = setup();
    const request = vi.fn().mockResolvedValue(ok());
    vi.stubGlobal("fetch", request);
    await ui.button("Approve case manifest");
    await ui.button("Run deterministic replay");
    expect(
      ui.render().filter((element) => element.type === ApprovalReceipt),
    ).toHaveLength(0);
    expect(request).not.toHaveBeenCalled();
    await ui.button("Approve executed mapping");
    await ui.button("Run deterministic replay");
    expect(request).not.toHaveBeenCalled();
    await ui.button("Approve case manifest");
    await ui.button("Run deterministic replay");
    expect(request).toHaveBeenCalledOnce();
  });

  it("keeps failed hashing visibly blocked in the actual component", async () => {
    const ui = setup();
    vi.stubGlobal("crypto", {});
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    await ui.button("Approve executed mapping");
    await ui.button("Run deterministic replay");
    expect(
      ui
        .render()
        .some((element) => element.props.className === "error-message"),
    ).toBe(true);
    expect(
      ui.render().filter((element) => element.type === ApprovalReceipt),
    ).toHaveLength(0);
    expect(request).not.toHaveBeenCalled();
  });

  it("isolates Dialect B approvals, revokes them on reason edits and ignores stale example hashes", async () => {
    const prepared = await prepareReplayScenarios();
    const guide = setup({ ...prepared, guided: true });
    await guide.button("Continue");
    const exampleElement = guide
      .render()
      .find((element) => element.type === CaseReplay)!;
    const example = setup(
      exampleElement.props as ComponentProps<typeof CaseReplay>,
    );
    const continueDisabled = () =>
      guide
        .render()
        .find(
          (element) =>
            element.type === "button" && element.props.children === "Continue",
        )!.props.disabled;
    const reasonInput = () =>
      example.render().find((element) => element.type === "input")!;
    await example.button("Approve executed mapping");
    expect(
      example.render().filter((element) => element.type === ApprovalReceipt),
    ).toHaveLength(0);
    reasonInput().props.onChange!({
      target: { value: "Reviewed as intentionally unmapped." },
    });
    await example.button("Approve executed mapping");
    const exampleReceipt = example
      .render()
      .find((element) => element.type === ApprovalReceipt)!;
    expect(continueDisabled()).toBe(true);
    expect(
      guide.render().filter((element) => element.type === ApprovalReceipt),
    ).toHaveLength(0);
    await guide.button("Approve executed mapping");
    const caseReceipt = guide
      .render()
      .find((element) => element.type === ApprovalReceipt)!;
    expect(exampleReceipt.props).not.toEqual(caseReceipt.props);
    expect(continueDisabled()).toBe(false);
    reasonInput().props.onChange!({ target: { value: "" } });
    expect(continueDisabled()).toBe(true);
    expect(
      example.render().filter((element) => element.type === ApprovalReceipt),
    ).toHaveLength(0);
    expect(
      guide.render().filter((element) => element.type === ApprovalReceipt),
    ).toHaveLength(1);
    reasonInput().props.onChange!({ target: { value: "New reason" } });
    const hash = deferred<ArrayBuffer>();
    vi.stubGlobal("crypto", {
      subtle: { digest: vi.fn().mockReturnValue(hash.promise) },
    });
    const pendingApproval = example.button("Approve executed mapping");
    reasonInput().props.onChange!({ target: { value: "" } });
    hash.resolve(new ArrayBuffer(32));
    await pendingApproval;
    expect(continueDisabled()).toBe(true);
    expect(
      example.render().filter((element) => element.type === ApprovalReceipt),
    ).toHaveLength(0);
  });
  it("clears previous evidence at run start and keeps it cleared on failure", async () => {
    const ui = setup();
    await ui.approve();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(ok())
        .mockRejectedValueOnce(new Error("failed")),
    );
    await ui.button("Run deterministic replay");
    expect(ui.evidence()).toHaveLength(1);
    const pending = ui.button("Run deterministic replay");
    expect(ui.evidence()).toHaveLength(0);
    await pending;
    expect(ui.evidence()).toHaveLength(0);
    expect(
      ui
        .render()
        .some((element) => element.props.className === "error-message"),
    ).toBe(true);
  });

  it("clears the repeat baseline when an approved input changes", async () => {
    const ui = setup();
    await ui.approve();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(ok()).mockResolvedValueOnce(ok()),
    );
    await ui.button("Run deterministic replay");
    await ui.button("Repeat the same approved case");
    expect(ui.hasText("Previous returned hash")).toBe(true);

    ui
      .render()
      .find(
        (element) =>
          element.props.name === "mutation" &&
          element.props.value === "shuffle",
      )!.props.onChange!({ target: { value: "shuffle" } });
    expect(ui.hasText("Previous returned hash")).toBe(false);
    expect(ui.evidence()).toHaveLength(0);
  });

  it("follows route mode changes and resets state when re-entering the guide", async () => {
    const prepared = await prepareReplayScenarios();
    const ui = setup({ ...prepared, guided: true });
    await ui.button("Continue");
    expect(
      ui
        .render()
        .some((element) => element.props.className === "journey-progress"),
    ).toBe(true);

    ui.setGuided(false);
    expect(
      ui
        .render()
        .some((element) => element.props.className === "journey-progress"),
    ).toBe(false);
    ui.changeScenario();
    await ui.button("Approve executed mapping");
    expect(
      ui.render().find((element) => element.type === "select")!.props.value,
    ).toBe(second);

    ui.setGuided(true);
    expect(
      ui.render().find((element) => element.type === "select")!.props.value,
    ).toBe(first);
    expect(
      ui.render().filter((element) => element.type === ApprovalReceipt),
    ).toHaveLength(0);
    expect(ui.evidence()).toHaveLength(0);
    ui.setGuided(false);
    expect(
      ui
        .render()
        .find(
          (element) =>
            element.props.name === "mutation" &&
            element.props.value === "baseline",
        )!.props,
    ).toHaveProperty("checked", true);

    const refreshed = setup({ ...prepared, guided: true });
    expect(
      refreshed.render().filter((element) => element.type === ApprovalReceipt),
    ).toHaveLength(0);
    expect(
      refreshed.render().find((element) => element.type === "select")!.props
        .value,
    ).toBe(first);
  });

  it.each([
    "scenario",
    "mutation",
    "mapping approval",
    "case approval",
  ] as const)("clears evidence after %s changes", async (change) => {
    const ui = setup();
    await ui.approve();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok()));
    await ui.button("Run deterministic replay");
    expect(ui.evidence()).toHaveLength(1);
    if (change === "scenario") ui.changeScenario();
    if (change === "mutation")
      ui
        .render()
        .find(
          (element) =>
            element.props.name === "mutation" &&
            element.props.value === "shuffle",
        )!.props.onChange!({ target: { value: "shuffle" } });
    if (change === "mapping approval")
      await ui.button("Mapping approved locally");
    if (change === "case approval") await ui.button("Case approved locally");
    expect(ui.evidence()).toHaveLength(0);
  });

  it.each([
    ["mapping", "success"],
    ["mapping", "failure"],
    ["case", "success"],
    ["case", "failure"],
  ] as const)(
    "ignores stale %s approval hash %s after a scenario change",
    async (kind, completion) => {
      const ui = setup();
      if (kind === "case") await ui.button("Approve executed mapping");
      const old = deferred<ArrayBuffer>();
      const current = deferred<ArrayBuffer>();
      vi.stubGlobal("crypto", {
        subtle: {
          digest: vi
            .fn()
            .mockReturnValueOnce(old.promise)
            .mockReturnValueOnce(current.promise),
        },
      });
      const label =
        kind === "mapping"
          ? "Approve executed mapping"
          : "Approve case manifest";
      const approvedLabel =
        kind === "mapping"
          ? "Mapping approved locally"
          : "Case approved locally";
      const oldApproval = ui.button(label);
      ui.changeScenario();
      if (kind === "case") {
        // A new source needs its own mapping approval before its case hash.
        const pendingCrypto = globalThis.crypto;
        vi.stubGlobal("crypto", {
          subtle: { digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)) },
        });
        await ui.button("Approve executed mapping");
        vi.stubGlobal("crypto", pendingCrypto);
      }
      const currentApproval = ui.button(label);
      if (completion === "success") old.resolve(new ArrayBuffer(32));
      else old.reject(new Error("obsolete hash failure"));
      await oldApproval;
      expect(
        ui.render().some((element) => element.props.children === approvedLabel),
      ).toBe(false);
      expect(
        ui
          .render()
          .some((element) => element.props.className === "error-message"),
      ).toBe(false);
      expect(ui.evidence()).toHaveLength(0);
      current.resolve(new ArrayBuffer(32));
      await currentApproval;
      expect(
        ui.render().some((element) => element.props.children === approvedLabel),
      ).toBe(true);
    },
  );

  it.each(["success", "review", "network failure"] as const)(
    "ignores an old %s after changing scenario while a new request is running",
    async (completion) => {
      const ui = setup();
      await ui.approve();
      const old = deferred<Response>();
      const current = deferred<Response>();
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockReturnValueOnce(old.promise)
          .mockReturnValueOnce(current.promise),
      );
      const oldRun = ui.button("Run deterministic replay");
      ui.changeScenario();
      await ui.approve();
      const currentRun = ui.button("Run deterministic replay");
      if (completion === "success") old.resolve(ok());
      if (completion === "review")
        old.resolve(
          Response.json(
            {
              workflowState: "INPUT_REVIEW_REQUIRED",
              issues: [{ message: "stale rejection" }],
            },
            { status: 422 },
          ),
        );
      if (completion === "network failure")
        old.reject(new Error("stale failure"));
      await oldRun;
      expect(ui.evidence()).toHaveLength(0);
      expect(
        ui.render().some((element) => element.props.children === "Replaying…"),
      ).toBe(true);
      expect(
        ui
          .render()
          .some((element) => element.props.className === "error-message"),
      ).toBe(false);
      current.resolve(Response.json({ ...result, scenario: second }));
      await currentRun;
      expect(ui.evidence()).toHaveLength(1);
      expect(ui.evidence()[0]!.props).toHaveProperty("scenario", second);
    },
  );
});
