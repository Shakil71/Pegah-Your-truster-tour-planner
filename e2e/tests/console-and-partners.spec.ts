import { expect, test } from "@playwright/test";
import { expectAccessible, staffSignIn } from "./helpers";

/** The console's main screens load on live data and pass the accessibility scan. */
test("staff sign in and the main console pages are accessible", async ({ page }) => {
  await staffSignIn(page);
  for (const path of [
    "/admin",
    "/admin/bookings",
    "/admin/customers",
    "/admin/catalog/hotels",
    "/admin/catalog/tours",
    "/admin/catalog/destinations",
    "/admin/payments",
    "/admin/refunds",
    "/admin/partners",
    "/admin/content",
    "/admin/staff",
    "/admin/promotions",
    "/admin/reports",
    "/admin/audit",
    "/admin/settings",
  ]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
    await expectAccessible(page, path);
  }
});

test("console refuses visitors without a staff session", async ({ page }) => {
  await page.goto("/admin/bookings");
  await expect(page).toHaveURL(/\/admin\/login/);
});

/**
 * Staff create a travel agent; the agent signs in to the partner portal,
 * books a stay for a client and sees the commission.
 */
test("an agent created in the console books for a client", async ({ page, browser }) => {
  await staffSignIn(page);
  const session = await page.request.get("/api/v1/staff/auth/session");
  const csrf = (await session.json()).csrfToken as string;
  const stamp = Date.now();
  const agentEmail = `e2e-agent-${stamp}@example.com`;
  const created = await page.request.post("/api/v1/admin/partners", {
    headers: { "x-csrf-token": csrf, origin: "http://localhost:3000" },
    data: {
      kind: "AGENT",
      name: `E2E Travels ${stamp}`,
      email: agentEmail,
      phone: "+8801711000009",
      commissionBps: 1000,
      member: { fullName: "Agent Rahim", email: agentEmail, password: "agent-e2e-pass-1" },
    },
  });
  expect(created.status()).toBe(201);

  const agentContext = await browser.newContext();
  const agent = await agentContext.newPage();
  await agent.goto("/partner/login");
  await agent.getByLabel("Email", { exact: true }).fill(agentEmail);
  await agent.getByLabel("Password").fill("agent-e2e-pass-1");
  await agent.getByRole("button", { name: "Sign in" }).click();
  await expect(agent.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expectAccessible(agent, "agent overview");

  await agent.goto("/stays?where=srimangal");
  await agent.locator('a[href^="/stays/demo-"]').first().click();
  await agent.getByRole("link", { name: "Book for a client" }).first().click();
  await expect(agent.getByText("Client contact (receives booking emails)")).toBeVisible();
  await agent.getByLabel("Full name", { exact: true }).fill("Client Karim");
  await agent.getByLabel("Email", { exact: true }).fill("client@example.com");
  await agent.getByLabel("Mobile", { exact: true }).fill("+8801911000000");
  const names = agent.getByLabel(/^(Lead guest \(adult\)|Adult \d+|Child \d+)$/);
  for (let i = 0; i < (await names.count()); i++) await names.nth(i).fill(`Client Guest ${i + 1}`);
  await agent.getByLabel(/holds the booking for 15 minutes/).check();
  await agent.getByRole("button", { name: "Hold for my client" }).click();

  await expect(agent).toHaveURL(/\/partner\/bookings\/[0-9A-Z]{26}/);
  await expect(agent.getByText("Held for your client").first()).toBeVisible();
  await expect(agent.getByRole("heading", { name: "Your commission" })).toBeVisible();
  await expectAccessible(agent, "agent booking");

  await agent.getByRole("button", { name: "Pay now" }).click();
  await agent.getByRole("button", { name: "Pay successfully" }).click();
  await expect(agent).toHaveURL(/\/partner\/bookings\/.*payment=success/);
  await expect(agent.getByText("Payment received. The booking is confirmed.")).toBeVisible();

  await agent.goto("/partner/statement");
  await expectAccessible(agent, "agent statement");
  await agentContext.close();
});

test("an announcement saved in the console appears on the website in both languages", async ({
  page,
  browser,
}) => {
  await staffSignIn(page);
  await page.goto("/admin/settings");
  await page.getByLabel("Show the banner on the website").check();
  await page.getByLabel("Message in English").fill("Eid holiday offers are live");
  await page.getByLabel("Message in Bangla").fill("ঈদের ছুটির অফার চলছে");
  await page.getByRole("button", { name: "Save banner" }).click();
  await expect(page.getByText(/Saved\. It applies/).first()).toBeVisible();

  const visitor = await browser.newContext();
  const site = await visitor.newPage();
  await site.goto("/stays?where=srimangal");
  await expect(site.getByText("Eid holiday offers are live")).toBeVisible();
  await site.getByRole("button", { name: "বাংলা" }).first().click();
  await expect(site.getByText("ঈদের ছুটির অফার চলছে")).toBeVisible();
  await visitor.close();

  // Turn it off again so other tests see a clean site.
  await page.getByLabel("Show the banner on the website").uncheck();
  await page.getByRole("button", { name: "Save banner" }).click();
  await expect(page.getByText(/Saved\. It applies/).first()).toBeVisible();
});

test("a photo uploaded in the console becomes a hotel's main photo on the website", async ({
  page,
}) => {
  const sharp = (await import("sharp")).default;
  const png = await sharp({
    create: { width: 1600, height: 1000, channels: 3, background: { r: 200, g: 120, b: 40 } },
  })
    .png()
    .toBuffer();

  await staffSignIn(page);
  await page.goto("/admin/catalog/media");
  await page.getByLabel("Photo (JPEG, PNG or WebP)").setInputFiles({
    name: "lodge.png",
    mimeType: "image/png",
    buffer: png,
  });
  await page
    .getByLabel("Description for screen readers (required)")
    .fill("Lodge veranda at sunset");
  await page.getByRole("button", { name: "Upload photo" }).click();
  await expect(page.getByText("Lodge veranda at sunset").first()).toBeVisible();
  await expectAccessible(page, "media library");

  await page.goto("/admin/catalog/hotels");
  await page.locator('a[href^="/admin/catalog/hotels/demo-"]').first().click();
  await page.getByRole("button", { name: /Choose photo|Change photo/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Lodge veranda at sunset/ })
    .first()
    .click();
  await page.getByRole("button", { name: /^Save/ }).first().click();
  await expect(page.getByText(/Saved\./).first()).toBeVisible();

  const slug = page.url().split("/").pop()!;
  await page.goto(`/stays/${slug}`);
  const hero = page.locator("section img").first();
  await expect(hero).toHaveAttribute("alt", "Lodge veranda at sunset");
  // Served through the Next.js image optimizer from the media library.
  await expect(hero).toHaveAttribute("src", /%2Fmedia%2F[a-f0-9]{24}\.webp/);
  await expect
    .poll(() => hero.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
    .toBeGreaterThan(0);
});
