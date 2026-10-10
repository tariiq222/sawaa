import { UpdateCouponHandler } from './update-coupon.handler';
import { ListCouponsHandler } from './list-coupons.handler';
const build = () => {
 const saved={id:'c',discountType:'PERCENTAGE',discountValue:10,maxUses:3,expiresAt:new Date('2026-10-11')};
 const prisma={coupon:{findFirst:jest.fn().mockResolvedValue(saved),update:jest.fn().mockImplementation(({data})=>({...saved,...data})),findMany:jest.fn().mockResolvedValue([]),count:jest.fn().mockResolvedValue(0)}};
 return {prisma,saved,handler:new UpdateCouponHandler(prisma as never)};
};
it('clears limits and expiry explicitly instead of preserving stale values',async()=>{
 const {handler}=build(); const result=await handler.execute({couponId:'c',maxUses:null,expiresAt:null} as any);
 expect(result.maxUses).toBeNull(); expect(result.expiresAt).toBeNull();
});
it('rejects changing discount type and oversized percentages',async()=>{
 const {handler,prisma}=build();
 await expect(handler.execute({couponId:'c',discountType:'FIXED'})).rejects.toThrow();
 await expect(handler.execute({couponId:'c',discountValue:101})).rejects.toThrow();
 expect(prisma.coupon.update).not.toHaveBeenCalled();
});
it('active filter excludes expired coupons',async()=>{
 const {prisma,saved}=build(); saved.expiresAt=new Date(0);
 prisma.coupon.findMany.mockImplementation(async ({where}:any)=>where.OR?.some((c:any)=>c.expiresAt?.gt) ? [] : [saved] as any);
 const tx={withTransaction:(cb:any)=>cb(prisma)};
 const result=await new ListCouponsHandler(prisma as never,tx as never).execute({status:'active'});
 expect(result.items).toEqual([]);
});
