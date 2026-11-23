import { suppressTracing } from '@sentry/nextjs';
import { getGoogleAnalyticsStreams } from '@/lib/analytics/google-streams';
import { isPublicAnalyticsPage } from '@/lib/analytics/public-pages';

export async function POST(request: Request): Promise<Response> {
  if (request.headers.get('sec-fetch-site') !== 'same-origin') {
    return new Response(null, { status: 403 });
  }

  const page = request.headers.get('x-sawaa-analytics-page');
  const client = request.headers.get('x-sawaa-analytics-client') ?? '';
  const session = request.headers.get('x-sawaa-analytics-session') ?? '';
  if (
    !isPublicAnalyticsPage(page)
    || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(client)
    || !/^[1-9][0-9]{9}$/.test(session)
  ) {
    return new Response(null, { status: 400 });
  }

  const body = JSON.stringify({
    client_id: client,
    consent: { ad_user_data: 'DENIED', ad_personalization: 'DENIED' },
    events: [{
      name: 'page_view',
      params: {
        page_location: new URL(page, 'https://sawaa.sa').href,
        session_id: Number(session),
      },
    }],
  });

  const results = await Promise.allSettled(getGoogleAnalyticsStreams().map(([id, secret]) => {
    const endpoint = new URL('https://www.google-analytics.com/mp/collect');
    endpoint.searchParams.set('measurement_id', id);
    endpoint.searchParams.set('api_secret', secret);
    // The Measurement Protocol secret is a query parameter. Keep it out of fetch spans.
    return suppressTracing(() => fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(2000),
    }));
  }));

  const sent = results.every(result => result.status === 'fulfilled' && result.value.ok);
  return new Response(null, { status: sent ? 204 : 502 });
}
