import { expect, test } from "@playwright/test";
import { expectAccessible, expectNoHorizontalScroll } from "./helpers";

/** Public pages render, are accessible, and fit a phone screen. */
const pages = [
  { path: "/", name: "home" },
  { path: "/hotels", name: "all hotels" },
  { path: "/stays?where=srimangal", name: "stay results" },
  { path: "/tours", name: "tours" },
  { path: "/login", name: "sign in" },
  { path: "/partner/login", name: "partner sign in" },
  { path: "/about", name: "about" },
  { path: "/contact", name: "contact" },
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

test("the phone menu opens and leads to the hotels page @mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.locator("#site-menu").getByRole("link", { name: "Hotels" }).click();
  await expect(page).toHaveURL(/\/hotels$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("a visitor sends a message from the contact page in the menu", async ({ page }) => {
  await page.goto("/");
  // Stays, Flights and Visa are off in the menu by default; Contact is always there.
  const menu = page.getByRole("navigation", { name: "Main" }).first();
  await expect(menu.getByRole("link", { name: "Visa" })).toHaveCount(0);
  await menu.getByRole("link", { name: "Contact" }).click();
  await expect(page).toHaveURL(/\/contact$/);

  await page.getByRole("button", { name: "A package or offer" }).click();
  const form = page.locator("main form").first();
  await form.getByLabel("Full name", { exact: true }).fill("Karim Ahmed");
  await form.getByLabel("Email", { exact: true }).fill("karim@example.com");
  await form.getByLabel("Phone or WhatsApp", { exact: true }).fill("+8801711000000");
  await form
    .getByLabel("Your message", { exact: true })
    .fill("Please send prices for the Umrah package in March.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("status")).toContainText(/PC-[2-9A-HJ-NP-Z]{6}/);
});

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

test("the partner portal sign-in works in Bangla @mobile", async ({ page }) => {
  await page.goto("/partner/login");
  await page.getByRole("button", { name: "বাংলা" }).click();
  await expect(page.getByRole("heading", { name: "সাইন ইন" })).toBeVisible();
  await expect(page.getByLabel("পাসওয়ার্ড")).toBeVisible();
  await expectAccessible(page, "partner sign in (Bangla)");
  await expectNoHorizontalScroll(page);
});
