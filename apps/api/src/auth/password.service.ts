import { Inject, Injectable } from "@nestjs/common";
import * as argon2 from "argon2";
import bcrypt from "bcryptjs";
import { APP_CONFIG, type AppConfig } from "../config/config";

/** Laravel bcrypt hashes ($2y$/$2b$/$2a$, cost 10–12) from the old website. */
export const isLegacyBcrypt = (hash: string) => /^\$2[aby]\$\d{2}\$.{53}$/.test(hash);

/** Argon2id password hashing (docs/security/SECURITY_MODEL.md). */
@Injectable()
export class PasswordService {
  private readonly options: argon2.HashOptions & { raw: false };
  private readonly costs: { memoryCost: number; timeCost: number; parallelism: number };
  private dummyHash: Promise<string> | undefined;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.costs = {
      memoryCost: config.ARGON2_MEMORY_KIB,
      timeCost: config.ARGON2_TIME_COST,
      parallelism: config.ARGON2_PARALLELISM,
    };
    this.options = { type: argon2.argon2id, raw: false, ...this.costs };
  }

  hash(password: string): Promise<string> {
    return argon2.hash(password, this.options);
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      if (isLegacyBcrypt(hash)) {
        // Customers imported from the old website (ADR-0038); upgraded to Argon2id on login.
        return await bcrypt.compare(password, hash.replace(/^\$2y\$/, "$2b$"));
      }
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  needsRehash(hash: string): boolean {
    if (isLegacyBcrypt(hash)) return true;
    return argon2.needsRehash(hash, this.costs);
  }

  /**
   * Burns the same time as a real verification when the account does not
   * exist, so response timing does not reveal which emails are registered.
   */
  async verifyAgainstDummy(password: string): Promise<false> {
    this.dummyHash ??= argon2.hash("pegah-timing-equaliser", this.options);
    await this.verify(await this.dummyHash, password);
    return false;
  }
}
