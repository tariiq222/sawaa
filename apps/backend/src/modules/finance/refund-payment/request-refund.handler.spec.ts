import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { RequestRefundHandler } from './request-refund.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('RequestRefundHandler', () => {
  let handler: RequestRefundHandler;
  let prisma: {
    invoice: { findFirst: jest.Mock };
    refundRequest: { findFirst: jest.Mock; create: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      invoice: { findFirst: jest.fn() },
      refundRequest: { findFirst: jest.fn(), create: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        RequestRefundHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get(RequestRefundHandler);
  });

  const cmd = { invoiceId: 'inv-1', clientId: 'client-1', reason: 'Changed mind' };

  it('throws when invoice not found', async () => {
    prisma.invoice.findFirst.mockResolvedValue(null);
    await expect(handler.execute(cmd)).rejects.toThrow(NotFoundException);
  });

  it('throws when invoice is not paid', async () => {
    prisma.invoice.findFirst.mockResolvedValue({ id: 'inv-1', status: 'DRAFT', payments: [] });
    await expect(handler.execute(cmd)).rejects.toThrow(BadRequestException);
  });

  it('throws when no completed payment exists', async () => {
    prisma.invoice.findFirst.mockResolvedValue({ id: 'inv-1', status: 'PAID', payments: [] });
    await expect(handler.execute(cmd)).rejects.toThrow('No completed payment found');
  });

  it('throws when refund request already exists', async () => {
    prisma.invoice.findFirst.mockResolvedValue({
      id: 'inv-1', status: 'PAID', payments: [{ id: 'pay-1', amount: 100 }],
    });
    prisma.refundRequest.findFirst.mockResolvedValue({ id: 'rr-1' });
    await expect(handler.execute(cmd)).rejects.toThrow(ConflictException);
  });

  it('creates refund request successfully', async () => {
    prisma.invoice.findFirst.mockResolvedValue({
      id: 'inv-1', status: 'PAID', payments: [{ id: 'pay-1', amount: 200 }],
    });
    prisma.refundRequest.findFirst.mockResolvedValue(null);
    prisma.refundRequest.create.mockResolvedValue({
      id: 'rr-1', status: 'PENDING_REVIEW', amount: 200, createdAt: new Date('2026-01-01'),
    });
    const result = await handler.execute(cmd);
    expect(result.id).toBe('rr-1');
    expect(result.amount).toBe(200);
    expect(prisma.refundRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reason: 'Changed mind', status: 'PENDING_REVIEW' }),
      }),
    );
  });

  it('creates refund request without reason', async () => {
    prisma.invoice.findFirst.mockResolvedValue({
      id: 'inv-1', status: 'PAID', payments: [{ id: 'pay-1', amount: 100 }],
    });
    prisma.refundRequest.findFirst.mockResolvedValue(null);
    prisma.refundRequest.create.mockResolvedValue({
      id: 'rr-1', status: 'PENDING_REVIEW', amount: 100, createdAt: new Date(),
    });
    await handler.execute({ invoiceId: 'inv-1', clientId: 'client-1' });
    expect(prisma.refundRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reason: undefined }),
      }),
    );
  });
});
