import type { PublicBranchSummary } from '@/services/client/branches';

/** Total steps in the package purchase flow: details, confirm. */
export const PACKAGE_FLOW_STEPS = 2;

/**
 * The package step route for the visitor: signed-in clients stay inside the
 * (client) group, guests use the public re-exports of the same screens so the
 * (client) guard does not send them to login before the confirm step.
 */
export function packageStepPath(step: 'confirm', signedIn: boolean): string {
  return signedIn ? `/(client)/packages/${step}` : `/public-packages/${step}`;
}

/**
 * The centre operates one branch, so the purchase never asks for it: the main
 * branch wins, otherwise the first listed one. Undefined while nothing loaded.
 */
export function resolveDefaultBranch<T extends Pick<PublicBranchSummary, 'id' | 'isMain'>>(branches: readonly T[] | undefined): T | undefined {
  if (!branches || branches.length === 0) return undefined;
  return branches.find((branch) => branch.isMain) ?? branches[0];
}
