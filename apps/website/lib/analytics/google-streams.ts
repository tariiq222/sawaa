export function getGoogleAnalyticsStreams(): Array<[measurementId: string, secret: string]> {
  const config = process.env.GA4_WEB_STREAMS;
  if (!config) return [];

  try {
    const streams: unknown = JSON.parse(config);
    if (streams === null || typeof streams !== 'object' || Array.isArray(streams)) return [];

    const entries = Object.entries(streams);
    return entries.every(([id, secret]) =>
      /^G-[A-Z0-9]{6,20}$/.test(id)
      && typeof secret === 'string'
      && /^[A-Za-z0-9_-]{8,128}$/.test(secret),
    ) ? entries : [];
  } catch {
    return [];
  }
}
