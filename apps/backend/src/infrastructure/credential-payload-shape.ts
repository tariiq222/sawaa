// credential-payload-shape — post-decrypt shape validation for provider
// credential payloads (email / sms / zoom / moyasar).
//
// This is NOT crypto: it runs strictly AFTER AES-GCM decryption and
// JSON.parse have both succeeded. It exists so a corrupted or mis-shaped
// row fails fast with a descriptive error instead of propagating
// `undefined` fields into provider adapters (Moyasar API calls, SMTP
// transports, Zoom OAuth, ...).
//
// SECURITY: error messages contain field NAMES only — never field values,
// which are secrets.
//
// NOTE: error messages must never match /auth|tag/i — the credential
// services use that pattern to detect GCM auth-tag failures and trigger
// the legacy-scheme fallback. A shape error must NOT look like one.

export type CredentialFieldType = "string" | "number" | "boolean";

export interface CredentialFieldSpec {
	name: string;
	type: CredentialFieldType;
	/** Field may be absent entirely (e.g. SMTP `secure`). */
	optional?: boolean;
	/** Strings are rejected when empty unless this is set (e.g. no-auth SMTP user/pass). */
	allowEmpty?: boolean;
}

export interface CredentialVariantSpec {
	/** Human-readable variant label used in error messages (e.g. "smtp"). */
	variant: string;
	fields: CredentialFieldSpec[];
}

function fieldProblem(
	payload: Record<string, unknown>,
	spec: CredentialFieldSpec,
): string | null {
	const value = payload[spec.name];
	if (value === undefined || value === null) {
		return spec.optional ? null : `${spec.name} (missing)`;
	}
	if (typeof value !== spec.type) {
		return `${spec.name} (expected ${spec.type})`;
	}
	if (spec.type === "string" && value === "" && !spec.allowEmpty) {
		return `${spec.name} (empty)`;
	}
	if (spec.type === "number" && !Number.isFinite(value)) {
		return `${spec.name} (not a finite number)`;
	}
	return null;
}

/**
 * Asserts that a decrypted credential payload matches at least one of the
 * declared variants. Throws a descriptive Error naming the service and the
 * offending FIELD NAMES (never their values) when no variant matches.
 */
export function assertCredentialPayloadShape(
	service: string,
	payload: unknown,
	variants: CredentialVariantSpec[],
): void {
	if (
		payload === null ||
		typeof payload !== "object" ||
		Array.isArray(payload)
	) {
		throw new Error(
			`${service}: decrypted credentials payload is not an object — ` +
				`the stored ciphertext is corrupted or was written by an incompatible version`,
		);
	}
	const record = payload as Record<string, unknown>;
	const failures: string[] = [];
	for (const variant of variants) {
		const problems = variant.fields
			.map((field) => fieldProblem(record, field))
			.filter((p): p is string => p !== null);
		if (problems.length === 0) return; // this variant is satisfied
		failures.push(`${variant.variant} → ${problems.join(", ")}`);
	}
	throw new Error(
		`${service}: decrypted credentials payload failed shape validation; ` +
			`no known credential shape matched [${failures.join("; ")}]`,
	);
}
