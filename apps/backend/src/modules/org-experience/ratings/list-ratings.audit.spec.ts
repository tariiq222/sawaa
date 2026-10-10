import { ListRatingsHandler } from './list-ratings.handler';

describe('ratings management information', () => {
  it('returns the rated employee name and average across all matched ratings', async () => {
    const tx = { rating: { findMany: jest.fn().mockResolvedValue([{id:'r1', employeeId:'e1', clientId:'c1', score:5}]), count: jest.fn().mockResolvedValue(30), aggregate: jest.fn().mockResolvedValue({_avg:{score:3.8}}) } };
    const prisma: any = { client: {findMany: jest.fn().mockResolvedValue([{id:'c1', name:'سارة'}])}, employee: {findMany: jest.fn().mockResolvedValue([{id:'e1', name:'أحمد', nameEn:'Ahmed'}])} };
    const handler = new ListRatingsHandler(prisma, {withTransaction:(fn:any)=>fn(tx)} as any);
    const result = await handler.execute({page:2, limit:1});
    expect(result.items[0]).toMatchObject({employee:{id:'e1', name:'أحمد', nameEn:'Ahmed'}});
    expect(result).toMatchObject({averageRating:3.8, meta:{total:30}});
  });
});
