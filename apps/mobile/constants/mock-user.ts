import type { AuthUser, MobileRole } from '@/types/auth';

export function buildMockUser(role: MobileRole): AuthUser {
  if (role === 'employee') {
    return {
      kind: 'staff',
      id: 'mock-employee-1',
      name: 'فيصل أحمد',
      firstName: 'فيصل',
      lastName: 'أحمد',
      email: 'employee@deqah.dev',
      phone: '+966500000000',
      avatarUrl: null,
      emailVerified: true,
      staffRole: 'EMPLOYEE',
      isSuperAdmin: false,
      permissions: [],
      organizationId: 'mock-org-1',
    };
  }

  return {
    kind: 'client',
    id: 'mock-client-1',
    name: 'سارة محمد',
    firstName: 'سارة',
    lastName: 'محمد',
    email: 'client@deqah.dev',
    phone: '+966500000000',
    avatarUrl: null,
    emailVerified: true,
    staffRole: null,
    isSuperAdmin: false,
    permissions: [],
    organizationId: 'mock-org-1',
  };
}

export const MOCK_ACCESS_TOKEN = 'dev.mock.access.token';
export const MOCK_REFRESH_TOKEN = 'dev.mock.refresh.token';
