import type { Bilingual } from "../../i18n/language";

/**
 * The copy of one working-mode panel, in both languages. The panel itself
 * sits in the matching `*-panel.tsx`.
 */
export interface PanelCopy<Panel> {
  readonly panel: Bilingual<Panel>;
}

/** Working mode numbers its panels in the order a case is worked. */
export const panelLabel = (order: string, label: string) =>
  `${order} · ${label}`;

/** Moves to an element on the page and takes focus there. */
export function reveal(target: HTMLElement | null) {
  if (!target) return;
  target.scrollIntoView({ block: "center", behavior: "smooth" });
  target.focus({ preventScroll: true });
}
