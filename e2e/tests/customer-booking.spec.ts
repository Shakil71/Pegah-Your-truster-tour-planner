import { expect, test } from "@playwright/test";
import { expectAccessible } from "./helpers";

/**
 * The core promise, as a customer sees it: create an account, hold a room,
 * pay on the (simulated) hosted page, and only then see "Confirmed".
 */
test("a customer holds a room, pays, and gets a confirmed booking with a voucher", async ({
  page,
}) => {
  const email = `e2e-${Date.now()}@example.com`;
  await page.goto("/login?mode=register");
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Full name").fill("Nusrat Jahan");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).not.toHaveURL(/\/login/);

  await page.goto("/stays?where=srimangal");
  await page.locator('a[href^="/stays/demo-"]').first().click();
  await page.getByRole("link", { name: "Hold this room" }).first().click();

  await expect(page.getByRole("heading", { name: "Who is travelling?" })).toBeVisible();
  await expectAccessible(page, "checkout");
  // The lead guest is pre-filled; name everyone else.
  const names = page.getByLabel(/^(Adult|Child) \d+$/);
  for (let i = 0; i < (await names.count()); i++) await names.nth(i).fill(`Traveller ${i + 2}`);
  await page.getByLabel("Mobile", { exact: true }).fill("+8801711000000");
  await page.getByLabel(/holds the booking for 15 minutes/).check();
  await page.getByRole("button", { name: "Hold my booking" }).click();

  await expect(page).toHaveURL(/\/account\/bookings\/[0-9A-Z]{26}\?new=1/);
  await expect(page.getByText("Held for you")).toBeVisible();
  // Never "Confirmed" before payment.
  await expect(page.getByText("Confirmed", { exact: true })).toHaveCount(0);
  await expectAccessible(page, "held booking");

  await page.getByRole("button", { name: "Pay now" }).click();
  await expect(page.getByText("Payment simulator")).toBeVisible();
  await page.getByRole("button", { name: "Pay successfully" }).click();

  await expect(page.getByText("Payment received. Your booking is confirmed.")).toBeVisible();
  await expect(page.getByText("Confirmed", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "Voucher and invoice" }).click();
  await expect(page.getByText(/Reference/).first()).toBeVisible();
  await expectAccessible(page, "voucher");

  await page.goto("/account/bookings");
  await expect(page.getByRole("heading", { name: "My trips" })).toBeVisible();
  await expectAccessible(page, "my trips");
});

test("a failed payment keeps the booking unconfirmed", async ({ page }) => {
  await page.goto("/login?mode=register");
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Full name").fill("Tanvir Ahmed");
  await page.getByLabel("Email").fill(`e2e-fail-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).not.toHaveURL(/\/login/);

  await page.goto("/tours");
  await page.locator('a[href^="/tours/demo-"]').first().click();
  await page.getByRole("link", { name: /^Hold \d+ seats?$/ }).click();
  await expect(page.getByRole("heading", { name: "Who is travelling?" })).toBeVisible();
  const names = page.getByLabel(/^(Adult|Child) \d+$/);
  for (let i = 0; i < (await names.count()); i++) await names.nth(i).fill(`Traveller ${i + 2}`);
  await page.getByLabel("Mobile", { exact: true }).fill("+8801711000000");
  await page.getByLabel(/holds the booking for 15 minutes/).check();
  await page.getByRole("button", { name: "Hold my booking" }).click();
  await expect(page.getByText("Held for you")).toBeVisible();

  await page.getByRole("button", { name: "Pay now" }).click();
  await page.getByRole("button", { name: "Payment fails" }).click();
  await expect(page.getByText(/did not go through/)).toBeVisible();
  await expect(page.getByText("Held for you")).toBeVisible();
  await expect(page.getByText("Confirmed", { exact: true })).toHaveCount(0);
});
