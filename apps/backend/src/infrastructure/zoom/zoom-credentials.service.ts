// zoom-credentials — Context-bound key derivation via HKDF + AES-256-GCM.
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
 * Known payload shape written by upsert-zoom-config.handler. All three fields
 * are validated non-empty before encryption, so stored rows always carry the
 * full Server-to-Server credential set.
 */
const PAYLOAD_VARIANTS: CredentialVariantSpec[] = [
	{
		variant: "server-to-server",
		fields: [
			{ name: "zoomAccountId", type: "string" },
			{ name: "zoomClientId", type: "string" },
			{ name: "zoomClientSecret", type: "string" },
		],
	},
];

@Injectable()
export class ZoomCredentialsService extends EncryptedCredentialsBase {
	constructor(cfg: ConfigService) {
		super(cfg, {
			serviceName: ZoomCredentialsService.name,
			envKeyName: "ZOOM_PROVIDER_ENCRYPTION_KEY",
			hkdfSalt: "deqah-zoom-creds-v1",
			legacyWarnLabel: "Zoom",
			payloadVariants: PAYLOAD_VARIANTS,
		});
	}
}
