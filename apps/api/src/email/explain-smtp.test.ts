import { describe, expect, it } from "vitest";
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
  });
});
