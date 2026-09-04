import {
  applyTransition,
  type WorkflowState,
  type WorkflowTransitionResult,
} from "@weavetrail/contracts";

export class RequestWorkflow {
  readonly #history: WorkflowState[] = ["UPLOADED"];
  #state: WorkflowState = "UPLOADED";

  get state(): WorkflowState {
    return this.#state;
  }

  get history(): readonly WorkflowState[] {
    return this.#history;
  }

  transition(to: WorkflowState): WorkflowTransitionResult {
    const result = applyTransition(this.#state, to);
    if (result.accepted) {
      this.#state = result.state;
      this.#history.push(result.state);
    }
    return result;
  }

  requireTransition(to: WorkflowState): void {
    const result = this.transition(to);
    if (!result.accepted) {
      throw new Error(
        `${result.code}: cannot transition from ${result.from} to ${result.to}`,
      );
    }
  }
}
