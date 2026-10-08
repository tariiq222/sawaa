export function assertIsolatedDatabase(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('An isolated database URL is required'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || url.hostname !== '127.0.0.1' || url.port !== '55761'
    || !/^\/sawaa_e2e_\d+$/.test(url.pathname) || url.search || url.hash) {
    throw new Error('Refusing writes outside the isolated local E2E database');
  }
  return url;
}
