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

// Exercise the actual CaseReplay handlers with persistent hook slots. This is a
// component-state regression harness, not a browser/hydration assertion.
const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0 }));
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
  };
});

type ElementProps = {
  children?: ReactNode;
  onClick?: () => Promise<void>;
  onChange?: (event: { target: { value: string } }) => void;
  value?: string;
  name?: string;
  className?: string;
  disabled?: boolean;
};
function elements(node: ReactNode): ReactElement<ElementProps>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
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
    hooks.slots = slots;
    hooks.cursor = 0;
    return elements(
      CaseReplay({
        proposals,
        scenarios,
        providerMode: "fixture",
        ...overrides,
      }),
    );
  }
  function button(label: string) {
    const element = render().find(
      (element) =>
        element.type === "button" && element.props.children === label,
    );
    if (!element?.props.onClick) throw new Error(`Missing button ${label}`);
    return element.props.onClick();
  }
  function changeScenario() {
    render().find((element) => element.type === "select")!.props.onChange!({
      target: { value: second },
    });
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
  return { render, button, changeScenario, evidence, approve };
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
function ok() {
  return Response.json(result);
}
afterEach(() => vi.unstubAllGlobals());

describe("replay result lifecycle", () => {
  it("requires an evaluated result, source inspection and a real repeat before retaining state in working mode", async () => {
    const prepared = await prepareReplayScenarios();
    const guide = setup({ ...prepared, initialGuided: true });
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
    const history = { replaceState: vi.fn() };
    vi.stubGlobal("window", { history });
    await guide.button("Continue in Case Replay");
    expect(history.replaceState).toHaveBeenCalledWith(null, "", "/replay");
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
    const guide = setup({ ...prepared, initialGuided: true });
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
