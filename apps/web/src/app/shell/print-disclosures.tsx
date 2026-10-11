"use client";

import { useEffect } from "react";

const PRINT_OPENED = "data-print-opened";

/**
 * Whether a disclosure is open only because the page is being printed. A
 * disclosure whose opening completes a step checks this, so printing never
 * does the reader's work for them.
 */
export function openedForPrint(element: Element): boolean {
  return element.hasAttribute(PRINT_OPENED);
}

/**
 * A printed page cannot open a disclosure, so every closed `<details>` opens
 * for the print and closes again afterwards; evidence a reader never expanded
 * on screen still reaches the paper. Each one is marked while it is open for
 * the print; a toggle event that fires after the print finds it closed again.
 */
export function PrintDisclosures() {
  useEffect(() => {
    let opened: HTMLDetailsElement[] = [];
    function beforePrint() {
      opened = [...document.querySelectorAll("details:not([open])")].map(
        (element) => element as HTMLDetailsElement,
      );
      for (const element of opened) {
        element.setAttribute(PRINT_OPENED, "");
        element.open = true;
      }
    }
    function afterPrint() {
      for (const element of opened) {
        element.open = false;
        element.removeAttribute(PRINT_OPENED);
      }
      opened = [];
    }
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    return () => {
      window.removeEventListener("beforeprint", beforePrint);
      window.removeEventListener("afterprint", afterPrint);
    };
  }, []);
  return null;
}
