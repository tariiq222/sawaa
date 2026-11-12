import { SetMetadata } from '@nestjs/common';

export const AUDIT_CONTROLLER_NAME_KEY = 'auditControllerName';

/**
 * Pins the controller name the AuditInterceptor uses to derive the audit
 * `entity` when a controller was split out of a larger one. Keeps ActivityLog
 * entities identical to what the original class produced.
 */
export const AuditControllerName = (name: string) => SetMetadata(AUDIT_CONTROLLER_NAME_KEY, name);
