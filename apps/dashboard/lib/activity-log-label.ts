export const ACTIVITY_MODULES = ['bookings', 'users', 'employees', 'payments', 'invoices', 'services', 'roles', 'branding', 'ratings']
export const ACTIVITY_ACTIONS = ['created', 'updated', 'deleted', 'login', 'logout', 'export', 'import', 'system']
export function activityActionLabel(raw: string, t: (key: string) => string): string {
  const action = ({ create: 'created', update: 'updated', delete: 'deleted' } as Record<string, string>)[raw.toLowerCase()] ?? raw.toLowerCase()
  return ACTIVITY_ACTIONS.includes(action) ? t(`auditOperations.activityAction.${action}`) : raw
}
export function activityModuleLabel(raw: string | null | undefined, t: (key: string) => string): string {
  if (!raw || raw === 'Unknown') return '—'
  const moduleName = raw.toLowerCase()
  const key = ACTIVITY_MODULES.includes(moduleName) ? moduleName : ACTIVITY_MODULES.find(m => m === `${moduleName}s`)
  return key ? t(`auditOperations.activityModule.${key}`) : raw.replace(/[-_]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')
}
