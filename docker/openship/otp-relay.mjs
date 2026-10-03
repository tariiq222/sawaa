import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// Staging-only egress boundary. Never accepts an upstream URL from a caller.
export function createOtpRelay({ apiKey, allowedPhones, fetchImpl = fetch }) {
  if (typeof apiKey !== 'string' || apiKey.length < 8 || !Array.isArray(allowedPhones) ||
      !allowedPhones.length || allowedPhones.some((phone) => !/^\+9665\d{8}$/.test(phone))) {
    throw new Error('A provider key and explicit Saudi test-phone allowlist are required');
  }
  const allowed = new Set(allowedPhones);
  const lastSend = new Map();
  const secret = Buffer.from(apiKey);
  const reply = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  const fail = (res, status) => reply(res, status, { success: false, errors: [{ message: 'Staging OTP request rejected' }] });
  const server = createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') return reply(res, 200, { status: 'ok' });
    const supplied = Buffer.from(typeof req.headers['x-authorization'] === 'string' ? req.headers['x-authorization'] : '');
    if (supplied.length !== secret.length || !timingSafeEqual(supplied, secret)) return fail(res, 401);
    const balance = req.method === 'GET' && req.url === '/api/v2/balance';
    const send = req.method === 'POST' && req.url === '/api/v2/send-otp';
    if (!balance && !send) return fail(res, 404);
    let payload;
    if (send) {
      if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') return fail(res, 415);
      try {
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 4096) { fail(res, 413); return; }
          chunks.push(chunk);
        }
        payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch { return fail(res, 400); }
      if (!payload || Array.isArray(payload) || typeof payload !== 'object' ||
          Object.keys(payload).some((key) => !['method', 'phone', 'otp', 'template_id'].includes(key)) ||
          payload.method !== 'sms' || typeof payload.phone !== 'string' || !allowed.has(payload.phone) ||
          typeof payload.otp !== 'string' || !/^\d{4,6}$/.test(payload.otp) || payload.template_id !== 1) {
        return fail(res, 403);
      }
      const now = Date.now();
      if (now - (lastSend.get(payload.phone) ?? 0) < 60_000) return fail(res, 429);
      // Reserve before awaiting upstream; concurrent requests cannot both send.
      lastSend.set(payload.phone, now);
    }
    try {
      const upstream = await fetchImpl(`https://api.authentica.sa/api/v2/${balance ? 'balance' : 'send-otp'}`, {
        method: balance ? 'GET' : 'POST',
        headers: { 'X-Authorization': apiKey, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: balance ? undefined : JSON.stringify(payload),
        redirect: 'error', signal: AbortSignal.timeout(8000),
      });
      if (!upstream.ok) return fail(res, 502);
      const result = await upstream.json();
      if (balance) {
        const amount = result?.data?.balance;
        if (result?.success === false || !['number', 'string'].includes(typeof amount) ||
            String(amount).trim() === '' || !Number.isFinite(Number(amount)) || Number(amount) < 0) return fail(res, 502);
      } else if (result?.success !== true) return fail(res, 502);
      // Do not forward provider metadata, OTPs, recipient details or error text.
      return reply(res, 200, balance ? { success: true, data: { balance: result.data?.balance } } : { success: true });
    } catch { return fail(res, 502); }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  server.timeout = 10000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createOtpRelay({
    apiKey: process.env.AUTHENTICA_API_KEY,
    allowedPhones: (process.env.AUTHENTICA_TEST_PHONES ?? '').split(',').map((phone) => phone.trim()).filter(Boolean),
  }).listen(8080, '0.0.0.0', () => console.log('Staging OTP relay listening'));
}
