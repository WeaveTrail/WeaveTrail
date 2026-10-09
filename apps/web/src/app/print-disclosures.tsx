"use client";

import { useEffect } from "react";

/**
 * A printed page cannot open a disclosure, so every closed `<details>` opens
 * for the print and closes again afterwards; evidence a reader never expanded
 * on screen still reaches the paper.
 */
export function PrintDisclosures() {
  useEffect(() => {
    let opened: HTMLDetailsElement[] = [];
    function beforePrint() {
      opened = [...document.querySelectorAll("details:not([open])")].map(
        (element) => element as HTMLDetailsElement,
      );
      for (const element of opened) element.open = true;
    }
    function afterPrint() {
      for (const element of opened) element.open = false;
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
