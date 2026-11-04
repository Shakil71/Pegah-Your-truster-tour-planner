"use client";

import { buttonClass } from "@pegah/ui";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("primary", "sm")}>
      Print or save as PDF
    </button>
  );
}
