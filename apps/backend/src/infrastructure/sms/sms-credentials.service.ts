// sms-credentials — Context-bound key derivation via HKDF + AES-256-GCM.
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
 * Known payload shapes written by upsert-org-sms-config.handler, one per
 * provider: Unifonic ({ appSid, apiKey }) or Taqnyat ({ apiToken }).
 */
const PAYLOAD_VARIANTS: CredentialVariantSpec[] = [
	{
		variant: "unifonic",
		fields: [
			{ name: "appSid", type: "string" },
			{ name: "apiKey", type: "string" },
		],
	},
	{ variant: "taqnyat", fields: [{ name: "apiToken", type: "string" }] },
];

@Injectable()
export class SmsCredentialsService extends EncryptedCredentialsBase {
	constructor(cfg: ConfigService) {
		super(cfg, {
			serviceName: SmsCredentialsService.name,
			envKeyName: "SMS_PROVIDER_ENCRYPTION_KEY",
			hkdfSalt: "deqah-sms-creds-v1",
			legacyWarnLabel: "SMS",
			payloadVariants: PAYLOAD_VARIANTS,
		});
	}
}
