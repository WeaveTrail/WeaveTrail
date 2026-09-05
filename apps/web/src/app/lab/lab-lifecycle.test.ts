import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { committedReplayScenarios } from "@weavetrail/scenarios";
import { Lab, RapidPriceLiftEvaluation, type LabScenario } from "./lab";

// Exercise the actual Lab handlers with persistent hook slots. This is a
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
      if (!(index in hooks.slots)) hooks.slots[index] = initial;
      return [
        hooks.slots[index],
        (value: unknown) => {
          hooks.slots[index] =
            typeof value === "function" ? value(hooks.slots[index]) : value;
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
function setup() {
  hooks.slots = [];
  const scenarios: LabScenario[] = [first, second].map((value) => {
    const fixture =
      committedReplayScenarios[value as typeof first | typeof second];
    const { approval: _, ...manifest } = fixture.manifest;
    void _;
    return {
      value: value as LabScenario["value"],
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
    hooks.cursor = 0;
    return elements(Lab({ proposals, scenarios, providerMode: "fixture" }));
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
  return { render, button, changeScenario, evidence };
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

describe("lab result lifecycle", () => {
  it("clears previous evidence at run start and keeps it cleared on failure", async () => {
    const ui = setup();
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
      await ui.button("Approve executed mapping");
    if (change === "case approval") await ui.button("Approve case manifest");
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
