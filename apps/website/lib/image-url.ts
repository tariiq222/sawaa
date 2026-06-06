// next/image only accepts absolute (http/https) or root-relative ("/...") src.
// Some employee records store a bare object key, which throws at render — guard it.
export function safeImageSrc(src: string | null | undefined): string | null {
  if (!src) return null;
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/')) {
    return src;
  }
  return null;
}
