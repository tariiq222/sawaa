// email-credentials — Context-bound key derivation via HKDF + AES-256-GCM.
//
// All crypto behavior (HKDF derivation, GCM layout, legacy master-key
// fallback, self-healing warn, post-decrypt shape validation) lives in
// EncryptedCredentialsBase — see infrastructure/crypto/encrypted-credentials.base.ts.
// This file only pins the per-service constants, which are load-bearing for
// ciphertext compatibility and must never change for existing rows.

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EncryptedCredentialsBase } from "../crypto/encrypted-credentials.base";
import type { CredentialVariantSpec } from "../credential-payload-shape";

/**
 * Known payload shapes written by upsert-org-email-config.handler:
 * SMTP ({ host, port, user, pass, secure? }) or an API-key provider
 * (Resend / SendGrid / Mailchimp — { apiKey }). The SMTP DTO permits empty
 * user/pass (no-auth relays), so those are type-checked but may be empty.
 */
const PAYLOAD_VARIANTS: CredentialVariantSpec[] = [
	{
		variant: "smtp",
		fields: [
			{ name: "host", type: "string" },
			{ name: "port", type: "number" },
			{ name: "user", type: "string", allowEmpty: true },
			{ name: "pass", type: "string", allowEmpty: true },
			{ name: "secure", type: "boolean", optional: true },
		],
	},
	{
		variant: "api-key (resend/sendgrid/mailchimp)",
		fields: [{ name: "apiKey", type: "string" }],
	},
];

@Injectable()
export class EmailCredentialsService extends EncryptedCredentialsBase {
	constructor(cfg: ConfigService) {
		super(cfg, {
			serviceName: EmailCredentialsService.name,
			envKeyName: "EMAIL_PROVIDER_ENCRYPTION_KEY",
			hkdfSalt: "deqah-email-creds-v1",
			legacyWarnLabel: "Email",
			payloadVariants: PAYLOAD_VARIANTS,
		});
	}
}
