import { Inject, Injectable } from "@nestjs/common";
import {
  hash as argon2Hash,
  parseOptions,
  verify as argon2Verify,
  type Options,
} from "@node-rs/argon2";
import bcrypt from "bcryptjs";
import { APP_CONFIG, type AppConfig } from "../config/config";

/** Laravel bcrypt hashes ($2y$/$2b$/$2a$, cost 10–12) from the old website. */
export const isLegacyBcrypt = (hash: string) => /^\$2[aby]\$\d{2}\$.{53}$/.test(hash);

/** `Algorithm.Argon2id` of @node-rs/argon2 (a const enum, so not importable as a value). */
const ARGON2ID = 2 as Options["algorithm"];

/**
 * Argon2id password hashing (docs/security/SECURITY_MODEL.md).
 *
 * Uses @node-rs/argon2, whose Linux binary needs only glibc 2.14, so it also
 * loads on older shared hosts (CloudLinux 8, glibc 2.28; ADR-0040). Hashes are
 * standard PHC strings, so hashes made earlier by node-argon2 still verify.
 */
@Injectable()
export class PasswordService {
  private readonly options: Options;
  private readonly costs: { memoryCost: number; timeCost: number; parallelism: number };
  private dummyHash: Promise<string> | undefined;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.costs = {
      memoryCost: config.ARGON2_MEMORY_KIB,
      timeCost: config.ARGON2_TIME_COST,
      parallelism: config.ARGON2_PARALLELISM,
    };
    this.options = { algorithm: ARGON2ID, ...this.costs };
  }

  hash(password: string): Promise<string> {
    return argon2Hash(password, this.options);
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      if (isLegacyBcrypt(hash)) {
        // Customers imported from the old website (ADR-0038); upgraded to Argon2id on login.
        return await bcrypt.compare(password, hash.replace(/^\$2y\$/, "$2b$"));
      }
      if (!hash.startsWith("$argon2")) return false;
      return await argon2Verify(hash, password);
    } catch {
      return false;
    }
  }

  /** True for old-website hashes, other algorithms, or costs below the current policy. */
  needsRehash(hash: string): boolean {
    if (isLegacyBcrypt(hash)) return true;
    try {
      const p = parseOptions(hash);
      return (
        p.algorithm !== ARGON2ID ||
        p.memoryCost !== this.costs.memoryCost ||
        p.timeCost !== this.costs.timeCost ||
        p.parallelism !== this.costs.parallelism
      );
    } catch {
      return true;
    }
  }

  /**
   * Burns the same time as a real verification when the account does not
   * exist, so response timing does not reveal which emails are registered.
   */
  async verifyAgainstDummy(password: string): Promise<false> {
    this.dummyHash ??= argon2Hash("pegah-timing-equaliser", this.options);
    await this.verify(await this.dummyHash, password);
    return false;
  }
}
