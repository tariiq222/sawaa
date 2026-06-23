/**
 * Escape the five HTML-significant characters so an untrusted value can be
 * safely interpolated into an HTML context without enabling injection.
 *
 * Apply this to the VALUE being injected (e.g. a user-supplied email template
 * variable), never to the surrounding template markup — escaping the markup
 * would render the email as literal tags.
 *
 * The `&` replacement must run first so the entities produced by the later
 * replacements are not double-escaped.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
