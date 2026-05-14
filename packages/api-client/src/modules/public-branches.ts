import { apiRequest } from '../client';
import type { PublicBranch } from '../types/public-directory';

export async function listPublicBranches(): Promise<PublicBranch[]> {
  return apiRequest<PublicBranch[]>('/public/branches');
}
