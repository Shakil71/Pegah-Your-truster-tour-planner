import { expect, test, type Page } from "@playwright/test";
import { expectAccessible, expectNoHorizontalScroll, staffSignIn } from "./helpers";

/** Visa services and flight requests (ADR-0039), end to end. */

async function registerCustomer(page: Page, name: string) {
  await page.goto("/login?mode=register");
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Full name").fill(name);
  await page
    .getByLabel("Email")
    .fill(`e2e-svc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test("a visa added in the console is listed, and a flight request is quoted by staff", async ({
  page,
  browser,
}) => {
  const slug = `e2e-visa-${Date.now()}`;
  await staffSignIn(page);
  await page.goto("/admin/visa-products");
  await page.getByRole("button", { name: "Add visa" }).click();
  await page.getByLabel("URL slug").fill(slug);
  await page.getByLabel("Status").selectOption("PUBLISHED");
  await page.getByLabel("Country", { exact: true }).fill("Nepal");
  await page.getByLabel("Visa type").fill("Tourist visa on arrival");
  await page.getByLabel("Processing time").fill("3–5 working days");
  await page.getByLabel("Price from, per traveller (৳)").fill("3500");
  await page
    .getByLabel("Summary (shown on the list)")
    .fill("Visa on arrival guidance and documents check.");
  await page.getByRole("button", { name: "Add visa" }).click();
  await expect(
    page.locator("li", { hasText: "Nepal · Tourist visa on arrival" }).first(),
  ).toBeVisible();
  await expectAccessible(page, "console visa services");

  const shopper = await browser.newContext();
  const site = await shopper.newPage();
  await site.goto("/visa");
  await expect(site.locator(`a[href="/visa/${slug}"]`)).toBeVisible();
  await expectAccessible(site, "visa list");
  await expectNoHorizontalScroll(site);
  await site.goto(`/visa/${slug}`);
  await expect(site.getByRole("link", { name: "Sign in to apply" })).toBeVisible();
  await expectAccessible(site, "visa detail");

  await registerCustomer(site, "Rafiq Hasan");
  await site.goto("/flights?from=Dhaka%20(DAC)&to=Bangkok%20(BKK)&date=2027-03-10");
  await expect(site.getByLabel("To", { exact: true })).toHaveValue("Bangkok (BKK)");
  await site.getByLabel("Return", { exact: true }).fill("2027-03-17");
  await site.getByLabel("Mobile (+8801…)").fill("+8801711000000");
  await expectAccessible(site, "flight request form");
  await site.getByRole("button", { name: "Request a price" }).click();
  await expect(site).toHaveURL(/\/account\/requests\//);
  await expect(site.getByText("Received").first()).toBeVisible();
  await expectAccessible(site, "request detail");
  const reference = (await site
    .getByText(/PF-[A-Z0-9]+/)
    .first()
    .textContent())!.match(/PF-[A-Z0-9]+/)![0];

  await page.goto(`/admin/requests?q=${reference}`);
  await page.getByRole("link", { name: /Dhaka \(DAC\) → Bangkok \(BKK\)/ }).click();
  await expectAccessible(page, "console request");
  await page.getByLabel("Total price (৳)").fill("48500");
  await page
    .getByLabel("Message to the customer (optional)")
    .fill("Return fare on a direct flight.");
  await page.getByRole("button", { name: "Send price" }).last().click();
  await expect(page.getByText("Quoted · awaiting payment").first()).toBeVisible();

  await site.reload();
  await expect(site.getByText("Price ready").first()).toBeVisible();
  await expect(site.getByText(/48,500/).first()).toBeVisible();
  await shopper.close();

  // Take the visa off the site again so other runs start clean.
  await page.goto("/admin/visa-products");
  await page
    .locator("li", { hasText: "Nepal · Tourist visa on arrival" })
    .first()
    .getByRole("button", { name: "Edit" })
    .click();
  await page.getByLabel("Status").selectOption("SUSPENDED");
  await page.getByRole("button", { name: "Save visa" }).click();
});
