/* Visa applications, flight requests and encrypted documents (ADR-0039) against MySQL 8.4. */
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ServiceRequestService } from "../services/service-request.service";
import { ADMIN_URL, createHarness, type Harness, type Session } from "./int-harness";

const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.from("passport page for Alice")]);
const contact = { name: "Alice Rahman", email: "alice-svc@example.com", phone: "+8801711000000" };

describe.skipIf(!ADMIN_URL)("visa and flight requests against MySQL 8.4", () => {
  let h: Harness;
  let alice: Session;
  let bob: Session;
  let owner: Session;
  let support: Session;
  let content: Session;

  const upload = (
    session: Session,
    url: string,
    body: Buffer,
    label = "Passport",
    name = "passport.pdf",
  ) =>
    h.call("POST", `${url}?label=${encodeURIComponent(label)}&name=${encodeURIComponent(name)}`, {
      session,
      headers: { "content-type": "application/octet-stream" },
      body,
    });

  beforeAll(async () => {
    h = await createHarness({
      DOCUMENT_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
      PUBLIC_BASE_URL: "http://localhost:3000",
    });
    alice = await h.register("alice-svc@example.com");
    bob = await h.register("bob-svc@example.com");
    owner = await h.staff("owner");
    support = await h.staff("support");
    content = await h.staff("content");
  }, 120_000);
  afterAll(() => h?.close());

  it("lets catalog staff publish a visa, which then appears on the website", async () => {
    const body = {
      slug: "thailand-tourist",
      country: "Thailand",
      visaType: "Tourist e-visa",
      summary: "60-day tourist e-visa for Bangladeshi passports.",
      processingTime: "7–10 working days",
      validity: "90 days",
      fee: { amountMinor: 650_000, currency: "BDT" },
      requirements: ["Passport (6 months valid)", "Photo 35×45 mm", "Bank statement (6 months)"],
      status: "PUBLISHED",
      sortOrder: 1,
    };
    expect(
      (await h.call("POST", "/admin/visa-products", { session: support, body })).statusCode,
    ).toBe(403);
    const made = await h.call("POST", "/admin/visa-products", { session: content, body });
    expect(made.statusCode).toBe(201);
    const list = (await h.call("GET", "/visas")).json();
    expect(list.items[0]).toMatchObject({
      slug: "thailand-tourist",
      fee: { amountMinor: 650_000 },
    });
    const detail = (await h.call("GET", "/visas/thailand-tourist")).json();
    expect(detail.requirements).toHaveLength(3);
    await h.call("POST", "/admin/visa-products", {
      session: content,
      body: { ...body, slug: "hidden-visa", status: "DRAFT" },
    });
    expect((await h.call("GET", "/visas/hidden-visa")).statusCode).toBe(404);
  });

  it("runs a visa application end to end: documents, info request, quote, payment, completion", async () => {
    const created = await h.call("POST", "/me/requests/visa", {
      session: alice,
      body: {
        visaProductSlug: "thailand-tourist",
        travellers: 2,
        details: { travelDate: "2027-01-10", purpose: "TOURISM" },
        contact,
        note: "Two adults",
      },
    });
    expect(created.statusCode).toBe(201);
    const r = created.json();
    expect(r).toMatchObject({
      kind: "VISA",
      status: "SUBMITTED",
      title: "Thailand · Tourist e-visa",
      travellers: 2,
      uploadsEnabled: true,
      canUpload: true,
      visa: { nationality: "BD", purpose: "TOURISM" },
    });
    expect(r.reference).toMatch(/^PV-[2-9A-Z]{6}$/);
    expect(
      await h.db.outboxEvent.count({
        where: { aggregateId: r.id, eventType: { startsWith: "service.created" } },
      }),
    ).toBe(2);

    // Documents: stored encrypted, readable by the owner, not by another customer.
    const up = await upload(alice, `/me/requests/${r.id}/documents`, PDF);
    expect(up.statusCode).toBe(201);
    const doc = up.json().documents[0];
    expect(doc).toMatchObject({
      label: "Passport",
      fileName: "passport.pdf",
      mime: "application/pdf",
    });
    const blob = await h.db.serviceDocumentBlob.findFirstOrThrow();
    expect(Buffer.from(blob.ciphertext).includes(Buffer.from("passport page"))).toBe(false);
    const got = await h.call("GET", `/me/requests/${r.id}/documents/${doc.id}`, { session: alice });
    expect(got.statusCode).toBe(200);
    expect(got.headers["content-type"]).toBe("application/pdf");
    expect(String(got.headers["content-disposition"])).toContain("attachment");
    expect(got.headers["cache-control"]).toContain("no-store");
    expect(got.rawPayload.equals(PDF)).toBe(true);
    expect((await h.call("GET", `/me/requests/${r.id}`, { session: bob })).statusCode).toBe(404);
    expect(
      (await h.call("GET", `/me/requests/${r.id}/documents/${doc.id}`, { session: bob }))
        .statusCode,
    ).toBe(404);
    expect((await upload(bob, `/me/requests/${r.id}/documents`, PDF)).statusCode).toBe(404);

    // Wrong type and empty files are refused.
    expect(
      (await upload(alice, `/me/requests/${r.id}/documents`, Buffer.from("<html>"))).statusCode,
    ).toBe(415);

    // Staff ask for more information; the customer replies and it goes back to the queue.
    const act = (body: Record<string, unknown>, session = support) =>
      h.call("POST", `/admin/requests/${r.id}/actions`, { session, body });
    expect(
      (
        await act({
          action: "NEEDS_INFO",
          expectedStatus: "SUBMITTED",
          message: "Please add a photo.",
        })
      ).statusCode,
    ).toBe(200);
    const replied = await h.call("POST", `/me/requests/${r.id}/reply`, {
      session: alice,
      body: { message: "Photo uploaded." },
    });
    expect(replied.json().status).toBe("SUBMITTED");

    // Stale screens cannot act twice.
    expect(
      (
        await act({
          action: "QUOTE",
          expectedStatus: "NEEDS_INFO",
          amount: { amountMinor: 1, currency: "BDT" },
        })
      ).statusCode,
    ).toBe(409);
    // Payment cannot be recorded before a quote.
    expect(
      (await act({ action: "MARK_PAID", expectedStatus: "SUBMITTED", paymentReference: "BK-1" }))
        .statusCode,
    ).toBe(409);

    const quoted = await act({
      action: "QUOTE",
      expectedStatus: "SUBMITTED",
      amount: { amountMinor: 1_300_000, currency: "BDT" },
      message: "Two travellers incl. embassy fee.",
    });
    expect(quoted.json()).toMatchObject({ status: "QUOTED", quote: { amountMinor: 1_300_000 } });
    expect(
      (
        await act({
          action: "NOTE",
          expectedStatus: "QUOTED",
          message: "Called, will pay today",
          internal: true,
        })
      ).statusCode,
    ).toBe(200);
    const paid = await act({
      action: "MARK_PAID",
      expectedStatus: "QUOTED",
      paymentReference: "bKash TX 8K2J",
    });
    expect(paid.json()).toMatchObject({ status: "PAID", paidOffline: "bKash TX 8K2J" });
    expect((await act({ action: "START", expectedStatus: "PAID" })).json().status).toBe(
      "IN_PROGRESS",
    );
    const done = await act({
      action: "COMPLETE",
      expectedStatus: "IN_PROGRESS",
      message: "Visa issued; e-visa attached.",
    });
    expect(done.json().status).toBe("COMPLETED");

    // The customer timeline hides internal notes; staff see them, and every step is audited.
    const mine = (await h.call("GET", `/me/requests/${r.id}`, { session: alice })).json();
    expect(
      mine.events.some((e: { message: string | null }) => e.message === "Called, will pay today"),
    ).toBe(false);
    expect(mine).toMatchObject({
      canCancel: false,
      canUpload: false,
      quote: { amountMinor: 1_300_000 },
    });
    const staffView = done.json();
    expect(staffView.staffEvents.some((e: { internal: boolean }) => e.internal)).toBe(true);
    const audits = await h.db.auditEvent.findMany({
      where: { targetId: r.id },
      select: { action: true },
    });
    expect(audits.map((a) => a.action)).toEqual(
      expect.arrayContaining([
        "service.needs_info",
        "service.quote",
        "service.mark_paid",
        "service.start",
        "service.complete",
        "service.note",
      ]),
    );
    // Staff opening a document is audited.
    await h.call("GET", `/admin/requests/${r.id}/documents/${doc.id}`, { session: support });
    expect(
      await h.db.auditEvent.count({ where: { action: "service.document.viewed", targetId: r.id } }),
    ).toBe(1);
    // Customers cannot upload to a closed request.
    expect((await upload(alice, `/me/requests/${r.id}/documents`, PDF)).statusCode).toBe(409);
  });

  it("takes flight requests, validates the trip and lets the customer cancel before paying", async () => {
    const bad = await h.call("POST", "/me/requests/flight", {
      session: alice,
      body: {
        details: {
          tripType: "ROUND_TRIP",
          from: "Dhaka (DAC)",
          to: "Bangkok (BKK)",
          departDate: "2027-02-10",
          returnDate: "2027-02-01",
          adults: 1,
          children: 0,
          infants: 2,
          cabin: "ECONOMY",
        },
        contact,
      },
    });
    expect(bad.statusCode).toBe(400);
    const ok = await h.call("POST", "/me/requests/flight", {
      session: alice,
      body: {
        details: {
          tripType: "ONE_WAY",
          from: "Dhaka (DAC)",
          to: "Cox's Bazar (CXB)",
          departDate: "2027-02-10",
          returnDate: "2027-02-12",
          adults: 2,
          children: 1,
          infants: 0,
          cabin: "ECONOMY",
          preferredAirline: "US-Bangla",
        },
        contact,
      },
    });
    expect(ok.statusCode).toBe(201);
    const f = ok.json();
    expect(f).toMatchObject({
      kind: "FLIGHT",
      travellers: 3,
      title: "Dhaka (DAC) → Cox's Bazar (CXB) · One way · Economy",
      flight: { returnDate: null, preferredAirline: "US-Bangla" },
    });
    expect(f.reference).toMatch(/^PF-/);
    const cancelled = await h.call("POST", `/me/requests/${f.id}/cancel`, {
      session: alice,
      body: { reason: "Plans changed" },
    });
    expect(cancelled.json()).toMatchObject({ status: "CANCELLED", canCancel: false });
    expect(
      (await h.call("POST", `/me/requests/${f.id}/cancel`, { session: alice, body: {} }))
        .statusCode,
    ).toBe(409);

    const list = (await h.call("GET", "/admin/requests?kind=FLIGHT", { session: owner })).json();
    expect(list.items).toHaveLength(1);
    const search = (
      await h.call("GET", `/admin/requests?q=${f.reference}`, { session: owner })
    ).json();
    expect(search.items[0].id).toBe(f.id);
    expect((await h.call("GET", "/admin/requests", { session: content })).statusCode).toBe(403);
  });

  it("deletes documents after the retention period and records it", async () => {
    const r = await h.db.serviceRequest.findFirstOrThrow({ where: { kind: "VISA" } });
    const svc = h.app.get(ServiceRequestService);
    expect(await svc.purgeDocuments(new Date())).toBe(0);
    const later = new Date(Date.now() + 91 * 86_400_000);
    expect(await svc.purgeDocuments(later)).toBeGreaterThanOrEqual(1);
    expect(await h.db.serviceDocument.count({ where: { requestId: r.id } })).toBe(0);
    expect(await h.db.serviceDocumentBlob.count()).toBe(0);
    const mine = (await h.call("GET", `/me/requests/${r.publicId}`, { session: alice })).json();
    expect(mine.documentsPurged).toBe(true);
    expect(mine.events.at(-1).message).toContain("deleted 90 days");
  });

  it("switches uploads off cleanly when no document key is configured", async () => {
    const h2 = await createHarness();
    try {
      const s = await h2.register("carol-svc@example.com");
      const f = await h2.call("POST", "/me/requests/flight", {
        session: s,
        body: {
          details: {
            tripType: "ONE_WAY",
            from: "Dhaka",
            to: "Sylhet",
            departDate: "2027-03-01",
            returnDate: null,
            adults: 1,
            children: 0,
            infants: 0,
            cabin: "ECONOMY",
          },
          contact: { ...contact, email: "carol-svc@example.com" },
        },
      });
      expect(f.json()).toMatchObject({ uploadsEnabled: false, canUpload: false });
      const up = await h2.call(
        "POST",
        `/me/requests/${f.json().id}/documents?label=Passport&name=p.pdf`,
        {
          session: s,
          headers: { "content-type": "application/octet-stream" },
          body: PDF,
        },
      );
      expect(up.statusCode).toBe(503);
    } finally {
      await h2.close();
    }
  }, 120_000);
});
