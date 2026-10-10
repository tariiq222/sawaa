import { normalizePublicImageUrl } from './public-image-url';

describe('employee public image URL', () => {
  it('gives a stored filename a browser-reachable stable API route', () => {
    const url = (normalizePublicImageUrl as (...args: string[]) => string | null)('old.jpg', 'employee-1', 'https://api.sawaa.test');
    expect(url).toMatch(/^https:\/\/api.sawaa.test\/api\/v1\/public\/employees\/employee-1\/image\?v=[a-f0-9]+$/);
  });
  it('routes internal MinIO URLs through the API', () => {
    const url = (normalizePublicImageUrl as (...args: string[]) => string | null)('http://minio:9000/deqah-v2/org/photo.jpg', 'employee-1', 'https://api.sawaa.test/api/v1/');
    expect(url).toMatch(/^https:\/\/api.sawaa.test\/api\/v1\/public\/employees\/employee-1\/image\?v=/);
  });
  it('changes the image URL when the selected object changes', () => {
    const build = normalizePublicImageUrl as (...args: string[]) => string | null;
    expect(build('org/a.jpg', 'e1', 'https://api.test')).not.toBe(build('org/b.jpg', 'e1', 'https://api.test'));
  });
});
