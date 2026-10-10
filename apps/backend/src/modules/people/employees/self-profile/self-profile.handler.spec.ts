import { ForbiddenException } from '@nestjs/common';
import { GetSelfProfileHandler, UpdateSelfProfileHandler } from './self-profile.handler';

function fixture() {
  const employee = { id: 'employee-a', userId: 'user-a', name: 'Nora', isActive: true, bioAr: 'old', publicBioAr: null, publicBioEn: null, bio: null, experience: 3, languages: [], avatarUrl: null, publicImageUrl: null };
  const user = { id: 'user-a', isActive: true, email: 'nora@example.com', phone: null, avatarUrl: null };
  const tx = {
    employee: { findFirst: jest.fn(async ({ where }) => where.userId === employee.userId && employee.isActive ? employee : null), update: jest.fn(async ({ data }) => Object.assign(employee, data)) },
    user: { findUnique: jest.fn(async () => user) },
  };
  const transactions = { withTransaction: async (fn: (value: typeof tx) => unknown) => fn(tx) };
  const images = { resolve: jest.fn(async (_type: string, _id: string, value: string | null) => value) };
  const read = new GetSelfProfileHandler(tx as never, images as never);
  const update = new UpdateSelfProfileHandler(transactions as never, read);
  return { employee, user, read, update, images };
}

describe('Employee self profile', () => {
  it('derives ownership from the session and rejects an unrelated user', async () => {
    const { read } = fixture();
    await expect(read.execute('user-b')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('saves public biography, years and languages without accepting administrative fields', async () => {
    const { update, employee } = fixture();
    const result = await update.execute('user-a', { bioAr: 'نبذة', bioEn: 'Biography', experience: 8, languages: ['العربية', 'English'], isActive: false, commissionRate: 0, email: 'attacker@example.com' } as never);
    expect(result).toMatchObject({ bioAr: 'نبذة', bioEn: 'Biography', experience: 8, languages: ['العربية', 'English'], email: 'nora@example.com' });
    expect(employee.isActive).toBe(true);
    expect(employee).not.toHaveProperty('commissionRate');
    expect(employee.publicBioAr).toBe('نبذة');
    expect(employee.publicBioEn).toBe('Biography');
  });

  it('allows clearing biography and years while preserving unrelated fields', async () => {
    const { update, employee } = fixture();
    await update.execute('user-a', { bioAr: '', experience: null, languages: [] });
    expect(employee.bioAr).toBe('');
    expect(employee.experience).toBeNull();
    expect(employee.name).toBe('Nora');
  });

  it('signs a dashboard-uploaded storage key through the owned image resolver', async () => {
    const { read, employee, images } = fixture();
    employee.publicImageUrl = 'org/photo.webp' as never;
    images.resolve.mockResolvedValueOnce('https://signed.example/photo.webp');
    const result = await read.execute('user-a');
    expect(images.resolve).toHaveBeenCalledWith('employee', 'employee-a', 'org/photo.webp');
    expect(result.avatarUrl).toBe('https://signed.example/photo.webp');
  });
});
