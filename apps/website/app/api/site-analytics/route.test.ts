// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mockGoogle = vi.fn<typeof fetch>();
const streamId = 'G-EXAMPLE001';
const secondStreamId = 'G-OTHER12345';

function visit(path: string, site = 'same-origin') {
  return new Request('https://sawaa.sa/api/site-analytics', {
    method: 'POST',
    headers: {
      'sec-fetch-site': site,
      'x-sawaa-analytics-page': path,
      'x-sawaa-analytics-client': '5824ad3f-af25-46c1-953e-a22ee88a0563',
      'x-sawaa-analytics-session': '1794387000',
      referer: 'https://sawaa.sa/about?email=someone@example.test',
    },
  });
}

describe('public site analytics', () => {
  beforeEach(() => {
    vi.stubEnv('GA4_WEB_STREAMS', JSON.stringify({
      [streamId]: 'test-secret',
      [secondStreamId]: 'other-test-secret',
    }));
    mockGoogle.mockReset().mockImplementation(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', mockGoogle);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('sends the same public page view to both configured properties', async () => {
    expect((await POST(visit('/about'))).status).toBe(204);
    const requests = mockGoogle.mock.calls.map(([destination, init]) => ({
      destination: String(destination),
      data: JSON.parse(String(init?.body)),
    }));
    expect(requests.map(({ destination }) => new URL(destination).searchParams.get('measurement_id')))
      .toEqual([streamId, secondStreamId]);
    for (const { data } of requests) {
      expect(data).toEqual({
        client_id: '5824ad3f-af25-46c1-953e-a22ee88a0563',
        consent: { ad_user_data: 'DENIED', ad_personalization: 'DENIED' },
        events: [{
          name: 'page_view',
          params: { page_location: 'https://sawaa.sa/about', session_id: 1794387000 },
        }],
      });
    }
  });

  it.each(['/booking', '/account', '/burnout-test', '/therapists/someone', '/about?name=someone'])(
    'discards a non-allowlisted path (%s)',
    async (path) => {
      expect((await POST(visit(path))).status).toBe(400);
      expect(mockGoogle).not.toHaveBeenCalled();
    },
  );

  it('rejects cross-origin requests without contacting Google', async () => {
    expect((await POST(visit('/about', 'cross-site'))).status).toBe(403);
    expect(mockGoogle).not.toHaveBeenCalled();
  });

  it('sends nothing when no streams are configured', async () => {
    vi.stubEnv('GA4_WEB_STREAMS', '');
    expect((await POST(visit('/about'))).status).toBe(204);
    expect(mockGoogle).not.toHaveBeenCalled();
  });

  it('still reaches the second stream if the first endpoint fails', async () => {
    mockGoogle.mockRejectedValueOnce(new Error('offline'));
    expect((await POST(visit('/about'))).status).toBe(502);
    expect(mockGoogle).toHaveBeenCalledTimes(2);
  });
});
