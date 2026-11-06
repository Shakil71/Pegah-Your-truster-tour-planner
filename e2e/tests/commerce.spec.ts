import { expect, test, type Page } from "@playwright/test";
import { expectAccessible, expectNoHorizontalScroll, staffSignIn } from "./helpers";

/** Offers, orders and gift cards (ADR-0032), end to end. */

async function registerCustomer(page: Page, name: string) {
  await page.goto("/login?mode=register");
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Full name").fill(name);
  await page
    .getByLabel("Email")
    .fill(`e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test("an offer created in the console is bought by a customer and marked paid by staff", async ({
  page,
  browser,
}) => {
  const slug = `e2e-offer-${Date.now()}`;
  await staffSignIn(page);
  await page.goto("/admin/offers");
  await page.getByRole("button", { name: "New offer" }).click();
  await page.getByLabel("Web address (slug)").fill(slug);
  await page.getByLabel("Status").selectOption("PUBLISHED");
  await page.getByLabel("Title (English)").fill("Sundarbans weekend escape");
  await page.getByLabel("Title (Bangla)").fill("সুন্দরবন উইকেন্ড ভ্রমণ");
  await page
    .getByLabel("Short summary (English)")
    .fill("Two nights on a river boat with all meals.");
  await page.getByLabel("Short summary (Bangla)").fill("সব খাবারসহ নদীর বোটে দুই রাত।");
  await page
    .getByLabel("What is included (English)")
    .fill("Boat cabin, meals, forest guide and permits.");
  await page.getByLabel("What is included (Bangla)").fill("বোট কেবিন, খাবার, গাইড ও অনুমতিপত্র।");
  await page.getByLabel("Price (৳ per package)").fill("12500");
  await page.getByLabel("Original price (৳, optional)").fill("15000");
  await page.getByRole("button", { name: "Save offer" }).click();
  await expect(page.getByText("Offer saved.")).toBeVisible();
  await expectAccessible(page, "console offers");

  const shopper = await browser.newContext();
  const site = await shopper.newPage();
  await registerCustomer(site, "Farhana Akter");
  await site.goto("/offers");
  await expectAccessible(site, "offers");
  await expectNoHorizontalScroll(site);
  await site.locator(`a[href="/offers/${slug}"]`).click();
  await expect(site).toHaveURL(new RegExp(`/offers/${slug}$`));
  await expectAccessible(site, "offer detail");
  await site.getByLabel("Mobile").fill("+8801711000000");
  await site.getByRole("button", { name: "Place order" }).click();
  await expect(site).toHaveURL(/\/account\/orders\//);
  await expect(site.getByText("Awaiting payment").first()).toBeVisible();
  await expectAccessible(site, "order");
  const reference = (await site
    .getByText(/PO-[A-Z0-9]+/)
    .first()
    .textContent())!.match(/PO-[A-Z0-9]+/)![0];

  await page.goto("/admin/orders");
  await page.getByRole("link", { name: reference }).click();
  await expect(page.getByLabel("Payment reference")).toBeVisible();
  await expectAccessible(page, "console order");
  await page.getByLabel("Payment reference").fill("bKash TrxID E2E123");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Mark as paid" }).click();
  await expect(page.getByText("bKash TrxID E2E123")).toBeVisible();

  await site.reload();
  await expect(site.getByText("Paid").first()).toBeVisible();
  await shopper.close();

  // Take it off sale again so other runs start clean.
  await page.goto("/admin/offers");
  await page.locator("li", { hasText: slug }).getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Status").selectOption("SUSPENDED");
  await page.getByRole("button", { name: "Save offer" }).click();
  await expect(page.getByText("Offer saved.")).toBeVisible();
});

test("a customer buys a gift card for a friend and staff see it once paid", async ({
  page,
  browser,
}) => {
  const shopper = await browser.newContext();
  const site = await shopper.newPage();
  await registerCustomer(site, "Tanvir Hasan");
  await site.goto("/gift-cards");
  await expectAccessible(site, "gift cards");
  await site.getByRole("button", { name: "For someone else" }).click();
  await site.getByLabel("Recipient's name").fill("Rumana Islam");
  await site.getByLabel("Recipient's email").fill("rumana@example.com");
  await site.getByLabel("Mobile").fill("+8801811000000");
  await site.getByRole("button", { name: /^Continue/ }).click();
  await expect(site).toHaveURL(/\/account\/orders\//);
  const reference = (await site
    .getByText(/PO-[A-Z0-9]+/)
    .first()
    .textContent())!.match(/PO-[A-Z0-9]+/)![0];

  await staffSignIn(page);
  await page.goto("/admin/orders?kind=GIFT_CARD");
  await page.getByRole("link", { name: reference }).click();
  await page.getByLabel("Payment reference").fill("Bank transfer E2E");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Mark as paid" }).click();
  await expect(page.getByText(/•••• [A-Z0-9]{4}/)).toBeVisible();

  await page.goto("/admin/gift-cards?q=rumana");
  await expect(page.getByText("Rumana Islam").first()).toBeVisible();
  await expectAccessible(page, "console gift cards");

  await site.reload();
  await expect(site.getByText(/rumana@example\.com/).first()).toBeVisible();
  await shopper.close();
});

test("the light and dark themes switch, persist and stay accessible @mobile", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to dark theme" }).first().click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/offers");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expectAccessible(page, "offers (dark)");
  await page.goto("/about");
  await expectAccessible(page, "about (dark)");
  await page.getByRole("button", { name: "Switch to light theme" }).first().click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("the console has a dark theme too", async ({ page }) => {
  await staffSignIn(page);
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  for (const path of ["/admin", "/admin/orders", "/admin/gift-cards"]) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expectAccessible(page, `${path} (dark)`);
  }
});
