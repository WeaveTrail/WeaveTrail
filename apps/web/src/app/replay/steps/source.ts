import type { PanelCopy } from "./step";

interface SourcePanel {
  readonly panelLabel: string;
  readonly selectLabel: string;
}

/**
 * Step 1: read the committed case, untouched. Nothing gates it; the rail's
 * Continue is its control.
 */
export const sourceStep: PanelCopy<SourcePanel> = {
  panel: {
    en: {
      panelLabel: "Committed source",
      selectLabel: "Committed source artifact",
    },
    ko: { panelLabel: "원본 거래자료", selectLabel: "커밋된 원본 거래자료" },
  },
};
