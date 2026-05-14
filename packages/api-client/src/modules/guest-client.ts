let guestBaseUrl = '';
let otpSessionToken: string | null = null;

export function setGuestBaseUrl(url: string): void {
  guestBaseUrl = url;
}

export function setOtpSessionToken(token: string | null): void {
  otpSessionToken = token;
}

export function getOtpSessionToken(): string | null {
  return otpSessionToken;
}

export async function guestApiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  const token = otpSessionToken;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${guestBaseUrl}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { message?: string }).message ?? res.statusText,
    );
  }

  if (res.status === 204) return undefined as T;
  const json = (await res.json()) as unknown;
  if (
    json &&
    typeof json === 'object' &&
    'success' in json &&
    'data' in json
  ) {
    return (json as { data: T }).data;
  }
  return json as T;
}