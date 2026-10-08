export function employeeAvatarUrl(origin: string | undefined, fileId: string): string {
  const base = (origin || 'http://localhost:5200').replace(/\/+$/, '').replace(/\/api\/v1$/, '');
  return `${base}/api/v1/public/employees/images/${fileId}`;
}
