// whatsapp-credentials — Context-bound key derivation via HKDF + AES-256-GCM.
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
 * Known payload shapes written by upsert-whatsapp-config.handler.
 * - "evolution-api": { evolutionApiKey }  (the only secret — baseUrl + instance
 *   name are non-secret and stored as plain columns)
 * - "meta-cloud": { phoneNumberId, businessAccountId, accessToken } — reserved
 *   for future Meta Cloud API support; not used today.
 * - "ai-api-key": { aiApiKey } — write-only OpenRouter key stored on the
 *   WhatsappAgentConfig row (used by AgentLlmService at runtime).
	 * - "webhook-secret": { webhookSecret } — Evolution `jwt_key` used to sign
	 *   short-lived webhook bearer tokens (used by WhatsappWebhookVerifier).
 */
const PAYLOAD_VARIANTS: CredentialVariantSpec[] = [
	{
		variant: "evolution-api",
		fields: [{ name: "evolutionApiKey", type: "string" }],
	},
	{
		variant: "meta-cloud",
		fields: [
			{ name: "phoneNumberId", type: "string" },
			{ name: "businessAccountId", type: "string" },
			{ name: "accessToken", type: "string" },
		],
	},
	{
		variant: "ai-api-key",
		fields: [{ name: "aiApiKey", type: "string" }],
	},
	{
		variant: "webhook-secret",
		fields: [{ name: "webhookSecret", type: "string" }],
	},
];

@Injectable()
export class WhatsappCredentialsService extends EncryptedCredentialsBase {
	constructor(cfg: ConfigService) {
		super(cfg, {
			serviceName: WhatsappCredentialsService.name,
			envKeyName: "WHATSAPP_PROVIDER_ENCRYPTION_KEY",
			hkdfSalt: "deqah-whatsapp-creds-v1",
			legacyWarnLabel: "WhatsApp",
			payloadVariants: PAYLOAD_VARIANTS,
			allowMissingKey: true,
		});
	}
}
