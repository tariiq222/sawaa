// encrypted-credentials.base — shared base for the provider credential
// services (email / sms / zoom / moyasar): context-bound key derivation via
// HKDF + AES-256-GCM.
//
// Security model:
//   master key (ENV)  +  contextId  →  HKDF-SHA256  →  deployment key
//
// Single-tenant compatibility: contextId is SINGLE_TENANT_CONTEXT_ID at call
// sites. A DB dump alone cannot decrypt credentials; the attacker needs both
// the master key and the stable context id used for existing ciphertext.
//
// Upgrade path: swap deriveKey() to call AWS KMS.GenerateDataKey per org
// when SOC-2 / HIPAA compliance is required — no changes needed elsewhere.
//
// ── P2.B compatibility (2026-06-09) ────────────────────────────────────────
// Rows written before 2026-05-09 were encrypted with the legacy
// `masterKey`-direct scheme (no HKDF). decrypt() tries the new scheme first;
// on GCM auth-tag mismatch it falls back to the legacy scheme so existing
// rows continue to work without operator re-entry. The upsert paths
// re-encrypt transparently, so the legacy branch is self-healing: once a row
// is re-saved it leaves the legacy codepath for good.
//
// All new encryptions still go through encrypt() which uses the new scheme.
// See scripts/rekey-credentials.ts for an operator-driven one-shot migration.
//
// CIPHERTEXT COMPATIBILITY: the per-service HKDF salt, the iv(12)||tag(16)||ct
// layout, and the constructor/env-key error wording are load-bearing — they
// must stay byte-identical or existing DB rows stop decrypting. Do not
// "improve" anything here without an explicit rekey migration.

import { InternalServerErrorException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
	createCipheriv,
	createDecipheriv,
	hkdfSync,
	randomBytes,
} from "crypto";
import {
	assertCredentialPayloadShape,
	type CredentialVariantSpec,
} from "../credential-payload-shape";

const HKDF_KEY_LEN = 32; // 256 bits

/** Per-service constants the concrete credential services plug into the base. */
export interface EncryptedCredentialsSpec {
	/**
	 * Concrete class name (e.g. "EmailCredentialsService"). Used as the Logger
	 * context and as the prefix of post-decrypt shape-validation errors.
	 */
	serviceName: string;
	/** ENV var holding the base64-encoded 32-byte master key. */
	envKeyName: string;
	/**
	 * Per-service HKDF salt (e.g. "deqah-email-creds-v1"). NEVER change for an
	 * existing deployment — it is baked into every stored ciphertext.
	 */
	hkdfSalt: string;
	/**
	 * Human label used in the legacy-fallback warn log, e.g. "Email" →
	 * "Email credentials decrypted with LEGACY master-key scheme …".
	 */
	legacyWarnLabel: string;
	/** Accepted post-decrypt payload shapes (see credential-payload-shape.ts). */
	payloadVariants: CredentialVariantSpec[];
}

export abstract class EncryptedCredentialsBase {
	private readonly masterKey: Buffer;
	protected readonly logger: Logger;

	protected constructor(
		cfg: ConfigService,
		private readonly spec: EncryptedCredentialsSpec,
	) {
		this.logger = new Logger(spec.serviceName);
		const raw = cfg.get<string>(spec.envKeyName);
		if (!raw) {
			throw new InternalServerErrorException(`${spec.envKeyName} missing`);
		}
		const key = Buffer.from(raw, "base64");
		if (key.length !== 32) {
			throw new InternalServerErrorException(
				`${spec.envKeyName} must decode to 32 bytes`,
			);
		}
		this.masterKey = key;
	}

	// ── Public API ────────────────────────────────────────────────────────────

	encrypt(payload: Record<string, unknown>, contextId: string): string {
		const key = this.deriveKey(contextId);
		const iv = randomBytes(12);
		const cipher = createCipheriv("aes-256-gcm", key, iv);
		const plain = Buffer.from(JSON.stringify(payload), "utf8");
		const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
		const tag = cipher.getAuthTag();
		// layout: iv(12) || tag(16) || ciphertext
		return Buffer.concat([iv, tag, ct]).toString("base64");
	}

	/**
	 * Decrypts a ciphertext produced by either the current HKDF scheme or the
	 * pre-2026-05-09 master-key-only scheme. Falls back to the legacy scheme
	 * on GCM auth-tag mismatch. The original (HKDF) error is re-thrown when
	 * BOTH schemes fail so the most diagnostic message is preserved.
	 *
	 * Security note: the fallback only attempts AES-GCM, never reveals any
	 * information beyond a yes/no answer to "is this a legacy row". Callers
	 * should re-persist the decrypted payload via the upsert paths so the row
	 * leaves the legacy codepath; this is what makes the fallback self-healing.
	 */
	decrypt<T extends Record<string, unknown>>(
		ciphertext: string,
		contextId: string,
	): T {
		let plain: Record<string, unknown>;
		try {
			plain = this.decryptWithKey(this.deriveKey(contextId), ciphertext);
		} catch (err) {
			// Legacy (pre-2026-05-09) scheme: masterKey used directly, no HKDF.
			// Only attempt the fallback when the error looks like a key/auth mismatch
			// (not a structural error like a too-short buffer).
			if (!this.looksLikeAuthFailure(err)) throw err;
			try {
				plain = this.decryptWithKey(this.masterKey, ciphertext);
			} catch {
				// Both schemes failed — surface the original (HKDF) error for diagnostics.
				throw err;
			}
			this.logger.warn(
				`${this.spec.legacyWarnLabel} credentials decrypted with LEGACY master-key scheme ` +
					`(context=${contextId}). Row should be re-saved via the upsert ` +
					`path to migrate to the HKDF scheme.`,
			);
		}
		// Post-decrypt shape validation: decryption and JSON.parse succeeded, so
		// reject malformed/corrupted payloads here instead of letting undefined
		// fields propagate into provider adapters. Field names only — no values.
		assertCredentialPayloadShape(
			this.spec.serviceName,
			plain,
			this.spec.payloadVariants,
		);
		return plain as T;
	}

	private decryptWithKey(
		key: Buffer,
		ciphertext: string,
	): Record<string, unknown> {
		const buf = Buffer.from(ciphertext, "base64");
		if (buf.length < 28) {
			throw new Error("Invalid ciphertext length");
		}
		const iv = buf.subarray(0, 12);
		const tag = buf.subarray(12, 28);
		const ct = buf.subarray(28);
		const decipher = createDecipheriv("aes-256-gcm", key, iv);
		decipher.setAuthTag(tag);
		const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
		return JSON.parse(plain.toString("utf8")) as Record<string, unknown>;
	}

	/**
	 * Returns true only when the error signature is consistent with a key/auth
	 * mismatch (so a fallback to the legacy scheme has a non-zero chance of
	 * succeeding). Structural errors — short buffer, invalid base64, JSON parse
	 * failures — propagate immediately because no scheme can recover them.
	 *
	 * NOTE: tests run under ts-jest can produce Error instances from a different
	 * realm than the one this file sees at runtime, so `instanceof Error` is
	 * unreliable in some test contexts. We duck-type on `.message` instead.
	 */
	private looksLikeAuthFailure(err: unknown): boolean {
		if (err === null || err === undefined) return false;
		if (typeof err !== "object") return false;
		const e = err as { message?: unknown; code?: unknown };
		if (typeof e.message !== "string") return false;
		const code = e.code;
		if (code === "ERR_OSSL_BAD_DECRYPT") return true;
		if (code === "ERR_CRYPTO_AUTH_TAG_LENGTH") return true;
		// decipher.final() throws an Error with message containing 'Unsupported
		// state' or 'auth' when the tag mismatches. Be permissive here — a false
		// positive just costs one extra AES attempt; a false negative breaks
		// legacy rows.
		return /auth|tag/i.test(e.message);
	}

	// ── Key derivation ────────────────────────────────────────────────────────

	/**
	 * Derives a 256-bit AES key for this deployment context using HKDF-SHA256.
	 *
	 *   key = HKDF(hash=SHA256, ikm=masterKey, salt=spec.hkdfSalt, info=contextId, len=32)
	 *
	 * Properties:
	 *  - Deterministic: same context id always gets same key, no key storage needed
	 *  - Isolated: different context id produces a completely different key
	 *  - Forward-safe: compromising one derived key does NOT reveal masterKey
	 *    or keys for other contexts
	 */
	private deriveKey(contextId: string): Buffer {
		return Buffer.from(
			hkdfSync(
				"sha256",
				this.masterKey,
				this.spec.hkdfSalt,
				contextId,
				HKDF_KEY_LEN,
			),
		);
	}
}
