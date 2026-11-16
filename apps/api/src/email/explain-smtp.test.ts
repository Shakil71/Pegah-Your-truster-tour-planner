import { describe, expect, it } from "vitest";
import { smtpImplicitTls } from "../settings/integration-settings.service";
import { explainSmtpError } from "./email.service";

describe("explainSmtpError", () => {
  it("names a refused login", () => {
    const e = Object.assign(new Error("Invalid login: 535 Incorrect authentication data"), {
      code: "EAUTH",
      responseCode: 535,
    });
    expect(explainSmtpError(e)).toMatch(/refused the user name or password/);
    expect(explainSmtpError(e)).toMatch(/EAUTH 535/);
  });

  it("names a port/TLS mismatch when the greeting never comes", () => {
    const e = Object.assign(new Error("Greeting never received"), { code: "ETIMEDOUT" });
    expect(explainSmtpError(e)).toMatch(/port 465 needs/);
  });

  it("points at a blocked port when the server cannot be reached", () => {
    const e = Object.assign(new Error("Connection timeout"), { code: "ETIMEDOUT" });
    expect(explainSmtpError(e)).toMatch(/try port 587/);
  });

  it("explains certificate, sender and unknown-host problems", () => {
    expect(
      explainSmtpError(new Error("Hostname/IP does not match certificate's altnames")),
    ).toMatch(/secure connection failed/);
    expect(
      explainSmtpError(Object.assign(new Error("Sender rejected"), { code: "EENVELOPE" })),
    ).toMatch(/same mailbox/);
    expect(
      explainSmtpError(Object.assign(new Error("getaddrinfo ENOTFOUND x"), { code: "EDNS" })),
    ).toMatch(/could not be found/);
    expect(explainSmtpError(new Error("??"))).toMatch(/^Sending failed/);
    const bounce = Object.assign(
      new Error("Can't send mail - all recipients were rejected: 550 owner@pegah.local"),
      { code: "EENVELOPE", responseCode: 550 },
    );
    expect(explainSmtpError(bounce)).toMatch(/Sign-in worked/);
  });
});

describe("smtpImplicitTls", () => {
  it("follows the port, whatever the switch says", () => {
    expect(smtpImplicitTls(465, false)).toBe(true);
    expect(smtpImplicitTls(587, true)).toBe(false);
    expect(smtpImplicitTls(25, true)).toBe(false);
    expect(smtpImplicitTls(2525, true)).toBe(true);
    expect(smtpImplicitTls(2525, false)).toBe(false);
  });
});
