
it('announces center program cancellation and pending money without cancelling terminal appointment history', () => {
  const { centerCancellationBody } = require('./client-cancellation-copy');
  const copy = centerCancellationBody({ reason: 'إلغاء البرنامج أسرة: تعذر التنفيذ', refund: { refundAmount: 2500, pendingRefundAmount: 1000, currency: 'SAR' } });
  expect(copy).toContain('إلغاء البرنامج أسرة');
  expect(copy).toContain('35.00 SAR');
  expect(copy).toContain('لم يكتمل');
  expect(copy).not.toContain('إلغاء موعدك');
});
