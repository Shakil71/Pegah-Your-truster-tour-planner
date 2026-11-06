import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/** Largest document accepted (Nginx allows 6 MB on the upload route only). */
export const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;
/** Documents per request (customer and staff together). */
export const DOCUMENTS_PER_REQUEST = 20;

/** Accepted file types, recognised by their first bytes (never by name or header). */
export function sniffDocument(bytes: Buffer): { mime: string; ext: string } | null {
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString("latin1") === "%PDF-") {
    return { mime: "application/pdf", ext: "pdf" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { mime: "image/png", ext: "png" };
  }
  return null;
}

/** A safe display/download name: no paths, no control or quote characters. */
export function safeFileName(name: string, ext: string): string {
  const base = name
    .replace(/^.*[\\/]/, "")
    .replace(/[^\p{L}\p{M}\p{N} ._()-]+/gu, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.[^.]*$/, "")
    .slice(0, 140);
  return `${base || "document"}.${ext}`;
}

export interface SealedDocument {
  keyId: string;
  iv: Buffer;
  authTag: Buffer;
  ciphertext: Buffer;
  sha256: string;
}

/**
 * AES-256-GCM for uploaded travel documents (ADR-0039). The document's public
 * id is bound as associated data, so a ciphertext cannot be swapped onto
 * another document row. `keyId` detects a rotated or missing key.
 */
export class DocumentVault {
  private readonly key: Buffer;
  readonly keyId: string;

  constructor(base64Key: string) {
    this.key = Buffer.from(base64Key, "base64");
    if (this.key.length !== 32) throw new Error("DOCUMENT_ENCRYPTION_KEY must be 32 bytes");
    this.keyId = createHash("sha256").update(this.key).digest("hex").slice(0, 16);
  }

  seal(plaintext: Buffer, documentId: string): SealedDocument {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(`doc:${documentId}`, "utf8"));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return {
      keyId: this.keyId,
      iv,
      authTag: cipher.getAuthTag(),
      ciphertext,
      sha256: createHash("sha256").update(plaintext).digest("hex"),
    };
  }

  /** Null when the key differs, the data was altered or the checksum does not match. */
  open(
    doc: { keyId: string; iv: Uint8Array; authTag: Uint8Array; sha256: string },
    ciphertext: Uint8Array,
    documentId: string,
  ): Buffer | null {
    if (doc.keyId !== this.keyId) return null;
    try {
      const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(doc.iv));
      decipher.setAAD(Buffer.from(`doc:${documentId}`, "utf8"));
      decipher.setAuthTag(Buffer.from(doc.authTag));
      const plain = Buffer.concat([decipher.update(Buffer.from(ciphertext)), decipher.final()]);
      return createHash("sha256").update(plain).digest("hex") === doc.sha256 ? plain : null;
    } catch {
      return null;
    }
  }
}
