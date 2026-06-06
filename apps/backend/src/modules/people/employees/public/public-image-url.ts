// Public surfaces (website next/image, mobile) require an absolute (http/https)
// or root-relative ("/...") image URL. Legacy rows may hold a bare object key,
// which crashes next/image — normalize those to null so no consumer breaks.
export function normalizePublicImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/')) {
    return value;
  }
  return null;
}
