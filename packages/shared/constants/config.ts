/** VAT rate for Saudi Arabia — 15% stored as integer basis points */
export const VAT_RATE = 1500;
export const VAT_PERCENTAGE = 15;

/** Pagination defaults */
export const DEFAULT_PAGE = 1;
export const DEFAULT_PER_PAGE = 20;
export const MAX_PER_PAGE = 100;

/** JWT token expiry */
export const ACCESS_TOKEN_EXPIRY = '15m';
export const REFRESH_TOKEN_EXPIRY = '7d';

/** OTP settings */
export const OTP_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = 10;

/** Rating limits */
export const MIN_RATING = 1;
export const MAX_RATING = 5;

/** File upload limits (bytes) */
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
