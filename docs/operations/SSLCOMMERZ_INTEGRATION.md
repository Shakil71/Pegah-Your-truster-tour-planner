# SSLCOMMERZ integration guide

Status: **built, switched off, not yet verified against the real sandbox**
(ADR-0022). Everything except the credentials is in place. Pegah has no
SSLCOMMERZ account yet, so the adapter was written from the published v4 API
documentation and tested with recorded response shapes and a simulator. Do the
sandbox checklist below before any customer pays.

## How it works

```
Customer: "Pay now" ─► POST /api/v1/me/bookings/{id}/payment-session
                          │  (payment row INITIATED, hold extended once by 20 min)
                          ▼
                       SSLCOMMERZ session API ──► GatewayPageURL
Browser ─► SSLCOMMERZ hosted page (card / bKash / Nagad / bank; never on Pegah)
                          │
          ┌───────────────┴──────────────────┐
          ▼                                  ▼
  IPN (server → server)              browser return (success/fail/cancel)
  POST /api/v1/payments/sslcommerz/ipn   POST /api/v1/payments/sslcommerz/return/{result}
          │                                  │
          └─────► stored in payment_events (deduplicated) ◄┘
                          │
                          ▼
              Validation API (server → server), by val_id or tran_id
                          │
       amount + currency match, risk 0, booking still PENDING_PAYMENT?
          │ yes                          │ no
          ▼                              ▼
  PENDING_PAYMENT → PAYMENT_PROCESSING   MANUAL_REVIEW (wrong amount / risky)
  → CONFIRMED; held rooms/seats → sold   or REFUND_REQUIRED (paid too late)
```

Guarantees, all covered by tests:

- A booking is confirmed **only** after SSLCOMMERZ's validation API says the
  payment is `VALID`/`VALIDATED` for our `tran_id`, with the exact amount
  (integer paisa) and currency. Browser callbacks alone change nothing.
- Duplicate IPNs and the IPN/browser race are harmless (`payment_events`
  unique key, row lock on the payment, state-machine compare-and-set).
- If callbacks never arrive, the hold sweeper asks SSLCOMMERZ by `tran_id`
  before expiring a booking, so a paid booking is confirmed, not expired.
- A payment that arrives after the hold expired never confirms the booking:
  the payment becomes `REFUND_REQUIRED` and an outbox event is written.
- No transaction is held open during an SSLCOMMERZ call. No card data is
  stored; the store password never appears in logs or error messages.

## Code map

| Piece                                                      | File                                                      |
| ---------------------------------------------------------- | --------------------------------------------------------- |
| Provider interface, money helpers                          | `apps/api/src/payments/provider.ts`                       |
| SSLCOMMERZ adapter (session, validation, query, signature) | `apps/api/src/payments/sslcommerz.provider.ts`            |
| Business rules (sessions, callbacks, confirmation)         | `apps/api/src/payments/payment.service.ts`                |
| HTTP endpoints                                             | `apps/api/src/payments/payment.controllers.ts`            |
| Simulator (dev/test only; refused in production)           | `apps/api/src/payments/simulator.provider.ts`             |
| Tables `payments`, `payment_events`                        | `packages/db/prisma/migrations/20261105090000_payments`   |
| Tests                                                      | `sslcommerz.provider.test.ts`, `test/payment.int.test.ts` |

Another gateway (bKash, Nagad, AamarPay…) = one new class implementing
`PaymentProvider` plus a `PAYMENT_PROVIDER` value; nothing else changes.

## Step 1 — get sandbox credentials (owner)

1. Register a sandbox store at <https://developer.sslcommerz.com/registration/>.
2. SSLCOMMERZ emails a **Store ID** and **Store Password**. Keep them out of
   chat, email threads and the repository.

## Step 2 — make the IPN reachable

SSLCOMMERZ's servers must reach
`https://<public host>/api/v1/payments/sslcommerz/ipn`. The server sits on a
private network, so either forward a public port to it on the router or wait
for the domain. Without IPN the flow still works through the browser return
and the sweeper's lookup, but IPN is the most reliable signal.

Register the IPN URL in the SSLCOMMERZ merchant panel as well.

## Step 3 — configure the server (owner, as `pegah`)

Edit `/opt/pegah/shared/env/api.env` (0600) and add:

```ini
PAYMENT_PROVIDER=sslcommerz
PUBLIC_BASE_URL=https://27.147.147.228:8443
SSLCOMMERZ_STORE_ID=<from email>
SSLCOMMERZ_STORE_PASSWORD=<from email>
SSLCOMMERZ_MODE=sandbox
```

Then restart: `sudo -n /usr/bin/systemctl restart pegah-api.service`. The API
refuses to start if anything is inconsistent (missing credentials, non-HTTPS
`PUBLIC_BASE_URL` in production, `live` without approval), and says which
variable is wrong without printing values.

The customer page shows **Pay now** as soon as `PAYMENT_PROVIDER` is set.

## Step 4 — sandbox checklist (do all before going live)

Use the sandbox test cards and wallets listed in the SSLCOMMERZ developer docs.

- [ ] Successful card payment → booking `CONFIRMED`, rooms/seats sold, admin
      **Payments** shows "Paid (verified)".
- [ ] Failed payment and cancelled payment → booking stays payable; customer
      can retry.
- [ ] IPN received (check `payment_events` rows with `kind = 'ipn'`) and
      `signature_ok = 1`. If `signature_ok` is 0, compare
      `verifySignature()` with the current SSLCOMMERZ docs.
- [ ] Close the browser on the success page before it returns → booking still
      confirms (IPN or sweeper).
- [ ] Pay after letting the hold expire → payment `REFUND_REQUIRED`, booking
      not confirmed; refund it from the SSLCOMMERZ panel.
- [ ] Amounts with paisa (e.g. ৳21,505.50) validate correctly.
- [ ] `journalctl -u pegah-api` shows no store password.
- [ ] Record the results in `docs/PROJECT_STATUS.md` and set the feature
      matrix row to TESTING/COMPLETE.

If any response field differs from what `mapSslcommerzRecord()` expects, fix
it there and in `sslcommerz.provider.test.ts` (one place each).

## Step 5 — go live (needs explicit owner approval)

1. Live store credentials from SSLCOMMERZ (after their KYC).
2. A real domain with a trusted certificate (ADR-0019 revisit).
3. In `api.env`: `SSLCOMMERZ_MODE=live` and `SSLCOMMERZ_LIVE_APPROVED=true`
   (the API will not start in live mode without the second line).
4. Restart the API; make one small real payment and refund it.

## Not built yet (next steps)

- Refund API calls (finance currently refunds from the SSLCOMMERZ panel; the
  `REFUND_REQUIRED` status and outbox event mark what to refund).
- Confirmation email/voucher on `booking.confirmed` (worker, needs Redis).
- EMI and `travel-vertical` product profile fields.
