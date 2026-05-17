import { BundlePriceService } from './bundle-price.service';
import { DiscountType } from '@prisma/client';

describe('BundlePriceService', () => {
  let service: BundlePriceService;

  beforeEach(() => {
    service = new BundlePriceService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('PERCENTAGE discount', () => {
    it('computes standard percentage discount', () => {
      const result = service.computeBundlePrice({
        servicePrices: [100, 50],
        discountType: DiscountType.PERCENTAGE,
        discountValue: 10,
      });
      expect(result.subtotal).toBe(150);
      expect(result.discountAmount).toBe(15);
      expect(result.finalPrice).toBe(135);
    });

    it('clamps PERCENTAGE > 100 to 100%', () => {
      const result = service.computeBundlePrice({
        servicePrices: [100, 200],
        discountType: DiscountType.PERCENTAGE,
        discountValue: 150,
      });
      expect(result.subtotal).toBe(300);
      expect(result.discountAmount).toBe(300);
      expect(result.finalPrice).toBe(0);
    });

    it('rounds to 2 decimal places', () => {
      const result = service.computeBundlePrice({
        servicePrices: [33.33, 33.33, 33.34],
        discountType: DiscountType.PERCENTAGE,
        discountValue: 10,
      });
      expect(result.subtotal).toBe(100);
      expect(result.discountAmount).toBe(10);
      expect(result.finalPrice).toBe(90);
    });
  });

  describe('FIXED discount', () => {
    it('computes standard fixed discount', () => {
      const result = service.computeBundlePrice({
        servicePrices: [200, 100],
        discountType: DiscountType.FIXED,
        discountValue: 50,
      });
      expect(result.subtotal).toBe(300);
      expect(result.discountAmount).toBe(50);
      expect(result.finalPrice).toBe(250);
    });

    it('clamps FIXED > subtotal to subtotal (finalPrice = 0)', () => {
      const result = service.computeBundlePrice({
        servicePrices: [50, 30],
        discountType: DiscountType.FIXED,
        discountValue: 200,
      });
      expect(result.subtotal).toBe(80);
      expect(result.discountAmount).toBe(80);
      expect(result.finalPrice).toBe(0);
    });

    it('rounds money to whole halalas for FIXED discount', () => {
      // Inputs that aren't whole halalas must be rounded to integers — money
      // is integer halalas, never fractional.
      const result = service.computeBundlePrice({
        servicePrices: [10.5, 20.75],
        discountType: DiscountType.FIXED,
        discountValue: 5.333,
      });
      expect(result.subtotal).toBe(31);
      expect(result.discountAmount).toBe(5);
      expect(result.finalPrice).toBe(26);
    });
  });
});
