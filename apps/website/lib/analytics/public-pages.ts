const publicAnalyticsPages = new Set([
  '/',
  '/about',
  '/services',
  '/clinics',
  '/therapists',
  '/blog',
]);

export function isPublicAnalyticsPage(path: string | null): path is string {
  return path !== null && publicAnalyticsPages.has(path);
}
