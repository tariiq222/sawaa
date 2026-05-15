import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { ClientLogoutHandler } from './client-logout.handler';
import { PrismaService } from '../../../infrastructure/database';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}));

describe('ClientLogoutHandler', () => {
  let handler: ClientLogoutHandler;
  let prisma: { clientRefreshToken: { findMany: jest.Mock; update: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      clientRefreshToken: {
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        ClientLogoutHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get(ClientLogoutHandler);
    jest.clearAllMocks();
  });

  it('revokes matching token', async () => {
    prisma.clientRefreshToken.findMany.mockResolvedValue([
      { id: 'tok-1', tokenHash: 'hash1' },
    ]);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    await handler.execute('rawtoken123', 'client-1');
    expect(prisma.clientRefreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'tok-1' }, data: { revokedAt: expect.any(Date) } }),
    );
  });

  it('does nothing when no candidates match', async () => {
    prisma.clientRefreshToken.findMany.mockResolvedValue([
      { id: 'tok-1', tokenHash: 'hash1' },
    ]);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    await handler.execute('rawtoken123', 'client-1');
    expect(prisma.clientRefreshToken.update).not.toHaveBeenCalled();
  });

  it('does nothing when no candidates found', async () => {
    prisma.clientRefreshToken.findMany.mockResolvedValue([]);
    await handler.execute('rawtoken123', 'client-1');
    expect(bcrypt.compare).not.toHaveBeenCalled();
    expect(prisma.clientRefreshToken.update).not.toHaveBeenCalled();
  });
});
