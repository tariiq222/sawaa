/** Total steps in the support-group registration flow: details, confirm. */
export const GROUP_FLOW_STEPS = 2;

/** The group confirm route for the visitor; guests use the public re-export. */
export function groupStepPath(step: 'confirm', signedIn: boolean): string {
  return signedIn ? `/(client)/groups/${step}` : `/public-groups/${step}`;
}
