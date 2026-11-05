import { expect, test } from "@playwright/test";
import { expectAccessible, expectNoHorizontalScroll } from "./helpers";

/** Public pages render, are accessible, and fit a phone screen. */
const pages = [
  { path: "/", name: "home" },
  { path: "/stays?where=srimangal", name: "stay results" },
  { path: "/tours", name: "tours" },
  { path: "/login", name: "sign in" },
  { path: "/partner/login", name: "partner sign in" },
  { path: "/about", name: "about" },
];

for (const p of pages) {
  test(`${p.name} is accessible @mobile`, async ({ page }) => {
    const res = await page.goto(p.path);
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
    await expectAccessible(page, p.name);
    await expectNoHorizontalScroll(page);
  });
}

test("property and tour pages are accessible @mobile", async ({ page }) => {
  await page.goto("/stays?where=srimangal");
  await page.locator('a[href^="/stays/demo-"]').first().click();
  await expect(page.getByRole("link", { name: "Hold this room" }).first()).toBeVisible();
  await expectAccessible(page, "property page");
  await expectNoHorizontalScroll(page);

  await page.goto("/tours");
  await page.locator('a[href^="/tours/demo-"]').first().click();
  await expect(page.getByRole("heading", { name: "Choose a departure" })).toBeVisible();
  await expectAccessible(page, "tour page");
  await expectNoHorizontalScroll(page);
});

test("checkout asks visitors to sign in first", async ({ page }) => {
  await page.goto("/checkout?product=TOUR");
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("the site switches to Bangla and stays accessible @mobile", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "বাংলা" }).first().click();
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("বাংলাদেশ");
  await expectAccessible(page, "home (Bangla)");
  await expectNoHorizontalScroll(page);

  // The choice is a cookie: other pages follow, URLs stay the same.
  await page.goto("/stays?where=srimangal");
  await expect(page.getByText("রুম দেখুন").first()).toBeVisible();
  await page.locator('a[href^="/stays/demo-"]').first().click();
  await expect(page.getByRole("link", { name: "এই রুম হোল্ড করুন" }).first()).toBeVisible();
  await expectAccessible(page, "property (Bangla)");

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "আবার স্বাগতম" })).toBeVisible();
  await page.getByRole("button", { name: "English" }).first().click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});
