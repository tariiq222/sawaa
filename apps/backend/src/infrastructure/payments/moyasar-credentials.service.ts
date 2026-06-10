// moyasar-credentials — Context-bound key derivation via HKDF + AES-256-GCM.
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
 * Known payload shapes written by upsert-moyasar-config.handler. The secret
 * key and the webhook secret are encrypted as SEPARATE single-field payloads
 * (`secretKeyEnc` / `webhookSecretEnc` columns), so decrypt() accepts either.
 */
const PAYLOAD_VARIANTS: CredentialVariantSpec[] = [
	{ variant: "secret-key", fields: [{ name: "secretKey", type: "string" }] },
	{
		variant: "webhook-secret",
		fields: [{ name: "webhookSecret", type: "string" }],
	},
];

@Injectable()
export class MoyasarCredentialsService extends EncryptedCredentialsBase {
	constructor(cfg: ConfigService) {
		super(cfg, {
			serviceName: MoyasarCredentialsService.name,
			envKeyName: "MOYASAR_ENCRYPTION_KEY",
			hkdfSalt: "deqah-moyasar-creds-v1",
			legacyWarnLabel: "Moyasar",
			payloadVariants: PAYLOAD_VARIANTS,
		});
	}
}
