import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for credentials entered in the console (ADR-0029).
 * Format: "v1:" + base64(iv[12] | tag[16] | ciphertext). The key never leaves
 * the server's environment; `keyId` is a short fingerprint used to detect a
 * missing or rotated key instead of failing with garbage.
 */
export class SecretBox {
  private readonly key: Buffer;
  readonly keyId: string;

  constructor(base64Key: string) {
    this.key = Buffer.from(base64Key, "base64");
    if (this.key.length !== 32) throw new Error("SETTINGS_ENCRYPTION_KEY must be 32 bytes");
    this.keyId = createHash("sha256").update(this.key).digest("hex").slice(0, 16);
  }

  seal(plaintext: string, aad: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(aad, "utf8"));
    const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return `v1:${Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64")}`;
  }

  /** Returns null when the value was sealed with another key or was tampered with. */
  open(sealed: string, aad: string): string | null {
    if (!sealed.startsWith("v1:")) return null;
    const raw = Buffer.from(sealed.slice(3), "base64");
    if (raw.length < 29) return null;
    try {
      const decipher = createDecipheriv("aes-256-gcm", this.key, raw.subarray(0, 12));
      decipher.setAAD(Buffer.from(aad, "utf8"));
      decipher.setAuthTag(raw.subarray(12, 28));
      return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
    } catch {
      return null;
    }
  }
}
