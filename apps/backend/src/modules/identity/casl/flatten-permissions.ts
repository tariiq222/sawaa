import { CaslAbilityFactory, type AppAbility, type AbilitySubjectUser } from './casl-ability.factory';

/**
 * Caller-supplied input for `flattenPermissions`.
 *
 * Pass `membershipRole` whenever the caller has resolved an active membership
 * (login, refresh, organization-switch). For platform-level surfaces with no
 * tenant context (super-admin /auth/me, /tenants/register) the legacy `role`
 * is acceptable as a fallback.
 */
export type PermissionSourceUser = AbilitySubjectUser;

/**
 * Converts CASL rules into the flat `module:action` strings the dashboard's
 * `canDo(module, action)` helper checks. `manage` maps to `*` (any action) and
 * `all` maps to `*` (any module), so (manage, all) → `"*"`.
 */
export function flattenPermissions(user: PermissionSourceUser): string[] {
  const factory = new CaslAbilityFactory();
  const ability: AppAbility = factory.buildForUser(user);
  const out = new Set<string>();

  for (const rule of ability.rules) {
    const actions = Array.isArray(rule.action) ? rule.action : [rule.action];
    const subjects = Array.isArray(rule.subject) ? rule.subject : [rule.subject];
    for (const a of actions) {
      const actionStr = a === 'manage' ? '*' : String(a);
      for (const s of subjects) {
        const subjectStr = s === 'all' ? '*' : String(s).toLowerCase();
        if (subjectStr === '*' && actionStr === '*') out.add('*');
        else out.add(`${subjectStr}:${actionStr}`);
      }
    }
  }

  return Array.from(out);
}
