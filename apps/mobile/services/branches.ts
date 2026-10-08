import { publicBranchesService } from './client/branches';

export type { PublicBranchSummary, PublicBranchDetail, PublicBranchEmployee } from './client/branches';

/** Compatibility aliases: public branch reads have one service owner. */
export const branchesService = {
  getAll: publicBranchesService.list,
  getById: publicBranchesService.getById,
  getEmployees: publicBranchesService.listEmployees,
};
