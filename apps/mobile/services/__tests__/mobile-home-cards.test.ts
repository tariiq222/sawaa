jest.mock('../api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

import api from '../api';
import { getMobileHomeCards, type PublicMobileHomeCard } from '../mobile-home-cards';

const mockedApi = api as unknown as { get: jest.Mock };

describe('getMobileHomeCards', () => {
  beforeEach(() => mockedApi.get.mockReset());

  it('gets and returns the public card list from the exact endpoint', async () => {
    const cards: PublicMobileHomeCard[] = [{
      id: 'card-1', titleAr: 'عنوان', titleEn: 'Title', descriptionAr: null, descriptionEn: 'Description',
      imageUrl: 'https://cdn.example/card.png', imageAltAr: 'صورة', imageAltEn: 'Image', destination: 'CLINICS',
    }];
    mockedApi.get.mockResolvedValueOnce({ data: cards });

    await expect(getMobileHomeCards()).resolves.toEqual(cards);
    expect(mockedApi.get).toHaveBeenCalledWith('/public/mobile-home-cards');
  });
});
