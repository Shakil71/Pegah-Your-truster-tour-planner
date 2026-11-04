/**
 * Transactional email templates: pure functions returning subject, plain
 * text and simple HTML. Every interpolated value is HTML-escaped. Wording is
 * honest: nothing says "confirmed" unless the booking is CONFIRMED.
 */

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export interface BookingFacts {
  reference: string;
  productName: string;
  startDate: string;
  endDate: string | null;
  guests: number;
  totalText: string;
  contactName: string;
  link: string | null;
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

function layout(
  title: string,
  paragraphs: string[],
  cta?: { label: string; href: string },
): RenderedEmail["html"] {
  return `<!doctype html><html lang="en"><body style="margin:0;background:#f6f3ee;font-family:Arial,Helvetica,sans-serif;color:#14172b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:28px">
<tr><td style="font-size:22px;font-weight:bold;padding-bottom:8px">Pegah</td></tr>
<tr><td style="font-size:20px;padding-bottom:12px">${esc(title)}</td></tr>
${paragraphs.map((p) => `<tr><td style="font-size:15px;line-height:1.5;padding-bottom:10px">${p}</td></tr>`).join("")}
${cta ? `<tr><td style="padding-top:8px"><a href="${esc(cta.href)}" style="display:inline-block;background:#FF852F;color:#14172b;font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:10px">${esc(cta.label)}</a></td></tr>` : ""}
<tr><td style="font-size:12px;color:#6b6f85;padding-top:18px">You receive this because of a booking or account action on Pegah.</td></tr>
</table></td></tr></table></body></html>`;
}

function tripLines(b: BookingFacts): string[] {
  return [
    `Booking reference: ${b.reference}`,
    `${b.productName}`,
    `Dates: ${b.startDate}${b.endDate ? ` to ${b.endDate}` : ""} · ${b.guests} guest${b.guests === 1 ? "" : "s"}`,
    `Total: ${b.totalText}`,
  ];
}

function render(
  title: string,
  intro: string,
  b: BookingFacts,
  outro: string,
  cta?: string,
): RenderedEmail {
  const lines = tripLines(b);
  const text = [
    `Hello ${b.contactName},`,
    "",
    intro,
    "",
    ...lines,
    "",
    outro,
    ...(b.link ? ["", b.link] : []),
  ].join("\n");
  const html = layout(
    title,
    [esc(`Hello ${b.contactName},`), esc(intro), lines.map(esc).join("<br>"), esc(outro)],
    b.link && cta ? { label: cta, href: b.link } : undefined,
  );
  return { subject: `${title} · ${b.reference}`, text, html };
}

export const templates = {
  bookingHeld: (b: BookingFacts, holdUntil: string) =>
    render(
      "Your booking is on hold",
      `We are holding this for you until ${holdUntil} (Dhaka time). It is not confirmed until payment is completed.`,
      b,
      "If you do not pay before the hold ends, it is released automatically.",
      "View booking",
    ),
  bookingConfirmed: (b: BookingFacts) =>
    render(
      "Booking confirmed",
      "Your payment was verified and your booking is confirmed. Your voucher is ready in your account.",
      b,
      "Show the voucher (on your phone or printed) at check-in.",
      "Open voucher",
    ),
  cancellationRequested: (b: BookingFacts) =>
    render(
      "Cancellation request received",
      "We received your request to cancel. Our team will review it against the cancellation policy and reply soon.",
      b,
      "Your booking stays valid until we confirm the cancellation.",
      "View booking",
    ),
  bookingCancelled: (b: BookingFacts, refundText: string | null) =>
    render(
      "Booking cancelled",
      refundText
        ? `Your booking is cancelled. A refund of ${refundText} has been approved and will be returned to your original payment method.`
        : "Your booking is cancelled. Under the cancellation policy no refund is due.",
      b,
      "We hope to welcome you on another trip.",
      "View booking",
    ),
  cancellationRejected: (b: BookingFacts, reason: string) =>
    render(
      "About your cancellation request",
      `We could not cancel this booking: ${reason}`,
      b,
      "Your booking remains confirmed. Reply to this email if you have questions.",
      "View booking",
    ),
  refundPaid: (b: BookingFacts, refundText: string) =>
    render(
      "Refund sent",
      `We have returned ${refundText}. Depending on your bank or wallet it can take a few days to appear.`,
      b,
      "Thank you for travelling with Pegah.",
      "View booking",
    ),
  passwordReset: (name: string, link: string): RenderedEmail => ({
    subject: "Reset your Pegah password",
    text: `Hello ${name},\n\nUse this link within 30 minutes to choose a new password:\n${link}\n\nIf you did not ask for this, ignore this email; your password stays the same.`,
    html: layout(
      "Reset your password",
      [
        esc(`Hello ${name},`),
        "Use the button within 30 minutes to choose a new password.",
        "If you did not ask for this, ignore this email; your password stays the same.",
      ],
      { label: "Choose a new password", href: link },
    ),
  }),
};
