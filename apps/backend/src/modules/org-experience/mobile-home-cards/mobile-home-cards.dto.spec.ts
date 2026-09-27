import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateMobileHomeCardDto, ReorderMobileHomeCardsDto, UpdateMobileHomeCardDto } from './mobile-home-cards.dto';

const errorsFor = async <T extends object>(type: new () => T, body: object) =>
  validate(plainToInstance(type, body));

const validContent = {
  titleAr: 'العنوان',
  titleEn: null,
  descriptionAr: null,
  descriptionEn: null,
  imageFileId: null,
  imageAltAr: null,
  imageAltEn: null,
  destination: null,
};

describe('mobile home card DTOs', () => {
  it('rejects blank Arabic titles and arbitrary destinations', async () => {
    const errors = await errorsFor(CreateMobileHomeCardDto, { ...validContent, titleAr: '   ', destination: '/evil' });
    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(['titleAr', 'destination']));
  });

  it('rejects overlong required titles and null title in a patch while allowing nullable clears', async () => {
    const longTitle = await errorsFor(CreateMobileHomeCardDto, { ...validContent, titleAr: 'أ'.repeat(101) });
    expect(longTitle.some((error) => error.property === 'titleAr')).toBe(true);
    const nullTitle = await errorsFor(UpdateMobileHomeCardDto, { titleAr: null, expectedUpdatedAt: '2026-09-27T00:00:00.000Z' });
    expect(nullTitle.some((error) => error.property === 'titleAr')).toBe(true);
    const clear = await errorsFor(UpdateMobileHomeCardDto, { titleEn: null, descriptionAr: null, imageFileId: null, expectedUpdatedAt: '2026-09-27T00:00:00.000Z' });
    expect(clear).toHaveLength(0);
  });

  it('requires an ISO version for partial updates', async () => {
    const errors = await errorsFor(UpdateMobileHomeCardDto, { titleAr: 'عنوان' });
    expect(errors.some((error) => error.property === 'expectedUpdatedAt')).toBe(true);
  });

  it('rejects invalid reorder item ids and negative sort order', async () => {
    const body = { ...validContent, sortOrder: -1 };
    const errors = await errorsFor(CreateMobileHomeCardDto, body);
    expect(errors.some((error) => error.property === 'sortOrder')).toBe(true);

    const reorderErrors = await errorsFor(ReorderMobileHomeCardsDto, {
      items: [
        { id: 'not-a-uuid', expectedUpdatedAt: '2026-09-27T00:00:00.000Z' },
        { id: '00000000-0000-4000-8000-000000000001', expectedUpdatedAt: '2026-09-27T00:00:00.000Z' },
      ],
    });
    expect(reorderErrors.some((error) => error.property === 'items')).toBe(true);
  });

  it('rejects null and out-of-range sort orders instead of coercing them', async () => {
    const nullOrder = await errorsFor(CreateMobileHomeCardDto, { ...validContent, sortOrder: null });
    expect(nullOrder.some((error) => error.property === 'sortOrder')).toBe(true);
    const highOrder = await errorsFor(CreateMobileHomeCardDto, { ...validContent, sortOrder: 2147483648 });
    expect(highOrder.some((error) => error.property === 'sortOrder')).toBe(true);
  });
});
