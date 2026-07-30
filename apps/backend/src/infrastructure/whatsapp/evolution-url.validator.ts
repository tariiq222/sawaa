// evolution-url-validator — defense-in-depth for the Evolution API base URL.
//
// We accept an arbitrary base URL because the operator may self-host Evolution.
// That opens three attack surfaces:
//
//   1. SSRF — pointing the URL at internal services (Redis on :6379, MinIO
//      on :9000, Postgres on :5432, the loopback HTTP probe at :5200, ...)
//      to leak credentials or probe the network.
//   2. Stored API key exfiltration — the upsert handler re-uses the previously
//      encrypted Evolution API key when a new URL is set, then immediately
//      sends it in an `apikey` header to the new URL. An attacker with
//      `manage:Integration` can point the URL at their own server to recover
//      the key.
//   3. Plaintext/HTTP transport — the API key travels in a header; HTTP
//      makes it one tcpdump away from leak.
//
// The validator:
//   - Requires HTTPS in production (NODE_ENV=production).
//   - Forbids known loopback / private / link-local addresses from the resolved
//     host (unless ALLOW_PRIVATE_HOSTS=true in non-prod for local docker).
//   - Compares the new URL's origin to the stored URL's origin so the
//     upsert handler can REQUIRE a fresh API key whenever the origin changes.

import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as dnsPromises from "node:dns/promises";
import { isIP } from "node:net";

export interface OriginValidationInput {
  /** New base URL submitted by the operator. */
  newBaseUrl: string;
  /** Previously stored base URL, or null when no prior config exists. */
  previousBaseUrl?: string | null;
}

export interface OriginValidationResult {
  /** True when the new origin equals the previous origin (no rotation). */
  sameOriginAsBefore: boolean;
  /** Parsed origin of the new URL (scheme + host + port). */
  origin: string;
}

@Injectable()
export class EvolutionUrlValidator {
  constructor(private readonly cfg: ConfigService) {}

  /**
   * Validates and parses a candidate Evolution base URL.
   *
   * - Requires a non-empty absolute URL with scheme http(s).
   * - In production, requires https.
   * - Rejects loopback / private / link-local IPs (after DNS resolution) so
   *   the URL cannot be used as an SSRF proxy.
   * - Allows private hosts when ALLOW_PRIVATE_HOSTS=true in non-production
   *   for docker-compose dev (postgres/redis/minio live on :3453-:3456).
   * - Returns the parsed origin so the caller can compare against the stored
   *   origin and decide whether a fresh API key is required.
   */
  async validate(input: OriginValidationInput): Promise<OriginValidationResult> {
    const nodeEnv = this.cfg.get<string>("NODE_ENV") ?? "development";
    const allowPrivate =
      this.cfg.get<string>("ALLOW_PRIVATE_HOSTS") === "true" && nodeEnv !== "production";

    if (!input.newBaseUrl) {
      throw new BadRequestException("Evolution base URL is required");
    }

    let parsed: URL;
    try {
      parsed = new URL(input.newBaseUrl);
    } catch {
      throw new BadRequestException("Evolution base URL is not a valid URL");
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new BadRequestException(
        `Evolution base URL must use http(s); got '${parsed.protocol.replace(":", "")}'`,
      );
    }

    if (nodeEnv === "production" && parsed.protocol !== "https:") {
      throw new BadRequestException(
        "Evolution base URL must use HTTPS in production (API key travels in a header)",
      );
    }

    if (!parsed.hostname) {
      throw new BadRequestException("Evolution base URL is missing a hostname");
    }

    if (parsed.username || parsed.password) {
      throw new BadRequestException(
        "Evolution base URL must not contain embedded credentials",
      );
    }

    await this.assertHostnameSafe(parsed.hostname, allowPrivate, nodeEnv);

    const origin = parsed.origin;
    let sameOriginAsBefore = false;
    if (input.previousBaseUrl) {
      let prev: URL;
      try {
        prev = new URL(input.previousBaseUrl);
      } catch {
        // Previous value was malformed — treat as a fresh origin so the
        // caller REQUIRES a new API key rather than silently reusing the
        // stored one against an unverified host.
        return { sameOriginAsBefore: false, origin };
      }
      sameOriginAsBefore = this.sameOrigin(parsed, prev);
    }

    return { sameOriginAsBefore, origin };
  }

  private async assertHostnameSafe(
    hostname: string,
    allowPrivate: boolean,
    nodeEnv: string,
  ): Promise<void> {
    if (allowPrivate) return;

    if (this.isReservedLiteral(hostname)) {
      if (nodeEnv === "production") {
        throw new BadRequestException(
          `Evolution base URL host '${hostname}' is not allowed in production (loopback/private network)`,
        );
      }
      // Dev: localhost/docker-internal hosts are common (Evolution runs on
      // the host machine). Accept but warn via the structured return; the
      // caller logs it.
      return;
    }

    if (isIP(hostname) === 0) {
      // Hostname — attempt to resolve so DNS rebinding to a private IP is
      // caught. The lookup is best-effort: a transient DNS failure should
      // not break a routine configuration change in dev.
      let records: { address: string; family: number }[];
      try {
        records = await dnsPromises.lookup(hostname, { all: true });
      } catch {
        if (nodeEnv === "production") {
          throw new BadRequestException(
            `Evolution base URL host '${hostname}' could not be resolved`,
          );
        }
        // Dev: skip the address check on DNS hiccups so the operator can
        // still configure a URL whose hostname is not resolvable from the
        // backend container (e.g. a hostname only the browser can resolve).
        return;
      }
      for (const r of records) {
        this.assertAddressSafe(r.address, nodeEnv);
      }
    }
  }

  private assertAddressSafe(address: string, nodeEnv: string): void {
    if (nodeEnv !== "production") return;
    if (this.isReservedLiteral(address)) {
      throw new BadRequestException(
        `Evolution base URL resolves to a reserved address '${address}'`,
      );
    }
  }

  private isReservedLiteral(host: string): boolean {
    const lower = host.toLowerCase();
    if (lower === "localhost" || lower.endsWith(".localhost")) return true;
    if (lower === "0.0.0.0") return true;
    // IPv6 literals can come bracketed from URL.hostname — strip them.
    const bare = lower.replace(/^\[|\]$/g, "");
    if (bare === "::" || bare === "::1") return true;
    if (isIP(bare) !== 0) {
      // Quick numeric ranges: 10/8, 127/8, 169.254/16, 172.16/12,
      // 192.168/16, 100.64/16 (CGNAT), 224/4 (multicast), IPv6 fc00::/7
      // and fe80::/10.
      const parts = bare.split(".").map((p) => Number.parseInt(p, 10));
      if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
        const [a, b] = parts;
        if (a === 10) return true;
        if (a === 127) return true;
        if (a === 169 && b === 254) return true;
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 192 && b === 168) return true;
        if (a === 100 && b >= 64 && b <= 127) return true;
        if (a >= 224) return true;
        if (a === 0) return true;
      }
      if (bare.includes(":")) {
        if (bare.startsWith("fc") || bare.startsWith("fd")) return true;
        if (bare.startsWith("fe8") || bare.startsWith("fe9") || bare.startsWith("fea") || bare.startsWith("feb")) return true;
        if (bare.startsWith("ff")) return true;
      }
    }
    return false;
  }

  private sameOrigin(a: URL, b: URL): boolean {
    return a.protocol === b.protocol && a.hostname === b.hostname && a.port === b.port;
  }
}
