import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DocumentVault, safeFileName, sniffDocument } from "./document-vault";

describe("DocumentVault", () => {
  const vault = new DocumentVault(randomBytes(32).toString("base64"));
  const file = Buffer.from("%PDF-1.7 passport scan");

  it("round-trips a document and stores no plaintext", () => {
    const sealed = vault.seal(file, "DOC1");
    expect(sealed.ciphertext.includes(Buffer.from("passport"))).toBe(false);
    expect(vault.open(sealed, sealed.ciphertext, "DOC1")?.equals(file)).toBe(true);
  });

  it("refuses another document id, a changed byte or another key", () => {
    const sealed = vault.seal(file, "DOC1");
    expect(vault.open(sealed, sealed.ciphertext, "DOC2")).toBeNull();
    const tampered = Buffer.from(sealed.ciphertext);
    tampered[0] = tampered[0]! ^ 1;
    expect(vault.open(sealed, tampered, "DOC1")).toBeNull();
    const other = new DocumentVault(randomBytes(32).toString("base64"));
    expect(other.open(sealed, sealed.ciphertext, "DOC1")).toBeNull();
  });
});

describe("document checks", () => {
  it("recognises PDF, JPEG and PNG by content only", () => {
    expect(sniffDocument(Buffer.from("%PDF-1.4"))?.mime).toBe("application/pdf");
    expect(sniffDocument(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg");
    expect(
      sniffDocument(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))?.mime,
    ).toBe("image/png");
    expect(sniffDocument(Buffer.from("<html><script>"))).toBeNull();
    expect(sniffDocument(Buffer.from("MZ\x90\x00"))).toBeNull();
  });

  it("cleans file names", () => {
    expect(safeFileName("C:\\Users\\me\\Passport scan.PDF", "pdf")).toBe("Passport scan.pdf");
    expect(safeFileName('../../etc/"evil";.exe', "png")).toBe("_evil_.png");
    expect(safeFileName("পাসপোর্ট.jpg", "jpg")).toBe("পাসপোর্ট.jpg");
    expect(safeFileName("", "pdf")).toBe("document.pdf");
  });
});
