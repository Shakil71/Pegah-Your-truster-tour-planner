import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/no-access";
import { OrderPill } from "@/components/order-pill";
import { PageHeader } from "@/components/page-header";
import { ensure, requireStaff, serverApi } from "@/lib/api-server";
import { dhakaDateTime, money } from "@/lib/format";
import { OrderActions } from "./order-actions";

export const metadata: Metadata = { title: "Order" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-[0.8rem] text-ink-3">{label}</dt>
      <dd className="text-[0.92rem]">{children}</dd>
    </div>
  );
}

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaff();
  if (!session.user.permissions.includes("payment:read")) {
    return <NoAccess what="orders" permission="payment:read" />;
  }
  const { id } = await params;
  const api = await serverApi();
  const result = await api.GET("/api/v1/admin/orders/{id}", { params: { path: { id } } });
  if (result.response.status === 404) notFound();
  const o = ensure(result);
  const canManage = session.user.permissions.includes("order:manage");

  return (
    <div className="mx-auto grid max-w-[1100px] gap-6">
      <PageHeader
        eyebrow={o.kind === "GIFT_CARD" ? "Gift card order" : "Offer order"}
        title={<span className="tabular">{o.reference}</span>}
        back={{ href: "/orders", label: "All orders" }}
        actions={<OrderPill status={o.status} />}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="panel p-5 md:p-6">
          <dl className="grid gap-3">
            <Row label="Item">
              {o.title}
              {o.kind === "OFFER" && <span className="text-ink-3"> × {o.quantity}</span>}
            </Row>
            <Row label="Total">
              <span className="tabular font-semibold">{money(o.total)}</span>
            </Row>
            <Row label="Placed">{dhakaDateTime(o.createdAt)}</Row>
            {o.status === "PENDING_PAYMENT" && (
              <Row label="Expires">{dhakaDateTime(o.expiresAt)}</Row>
            )}
            {o.paidAt && <Row label="Paid">{dhakaDateTime(o.paidAt)}</Row>}
            {o.paidOffline && <Row label="Paid offline">{o.paidOffline}</Row>}
            <Row label="Buyer">
              {o.buyer.name}
              <p className="text-[0.84rem] text-ink-2">
                <a href={`mailto:${o.buyer.email}`} className="hover:underline">
                  {o.buyer.email}
                </a>
                {" · "}
                <a href={`tel:${o.buyer.phone}`} className="tabular hover:underline">
                  {o.buyer.phone}
                </a>
              </p>
            </Row>
            <Row label="Customer account">
              <Link href={`/customers/${o.customer.id}`} className="font-semibold hover:underline">
                {o.customer.fullName}
              </Link>
            </Row>
            {o.recipient && (
              <Row label="Gift for">
                {o.recipient.name} · {o.recipient.email}
              </Row>
            )}
            {o.giftMessage && <Row label="Gift message">{o.giftMessage}</Row>}
            {o.note && <Row label="Customer note">{o.note}</Row>}
            {o.giftCard && (
              <Row label="Gift card">
                <span className="tabular">•••• {o.giftCard.last4}</span> · balance{" "}
                {money(o.giftCard.balance)} · valid to {dhakaDateTime(o.giftCard.expiresAt)} ·{" "}
                <Link
                  href={`/gift-cards?q=${o.giftCard.last4}`}
                  className="font-semibold hover:underline"
                >
                  manage
                </Link>
              </Row>
            )}
          </dl>
        </section>
        <aside className="grid content-start gap-4">
          {o.status === "PENDING_PAYMENT" && canManage ? (
            <OrderActions id={o.id} csrfToken={session.csrfToken} />
          ) : (
            <p className="panel p-5 text-[0.88rem] text-ink-2">
              {o.status === "PENDING_PAYMENT"
                ? "Waiting for the customer to pay. Staff with order permission can record an offline payment."
                : "No actions: this order is closed."}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
