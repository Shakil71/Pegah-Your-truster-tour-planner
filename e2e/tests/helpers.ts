import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const stack = JSON.parse(
  readFileSync(resolve(__dirname, "../.state/stack.json"), "utf8"),
) as { staffEmail: string; staffPassword: string };

/**
 * WCAG 2.1 A/AA scan of the current page. Fails on serious or critical
 * violations and prints what was found so it can be fixed, not muted.
 */
export async function expectAccessible(page: Page, label: string) {
  // Entrance animations fade content in; scan the settled page, not a mid-fade frame.
  // (Endless ones, such as live-status pulses, are skipped.)
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = result.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  const report = blocking.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n` +
      v.nodes
        .slice(0, 5)
        .map((n) => `    ${n.target.join(" ")}`)
        .join("\n"),
  );
  expect(report, `Accessibility problems on ${label}`).toEqual([]);
}

/** The page never scrolls sideways (phone layouts). */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "horizontal overflow in px").toBeLessThanOrEqual(1);
}

export async function staffSignIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Work email").fill(stack.staffEmail);
  await page.getByLabel("Password").fill(stack.staffPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/admin\/login/);
}
