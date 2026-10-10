/* global URL, module -- Shared by Node's Expo config loader and React Native. */
const DEVELOPMENT_API_URL = 'http://localhost:5200/api/v1';
const RELEASE_API_HOSTS = {
  staging: 'staging.sawaa.sa',
  production: 'api.sawaa.sa',
};

function isPrivateIpv4(hostname) {
  const octets = hostname.split('.');
  if (octets.length !== 4 || octets.some((octet) => !/^\d+$/.test(octet))) {
    return false;
  }

  const [first, second] = octets.map(Number);
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isLocalOrPrivateHost(hostname) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local')
  ) {
    return true;
  }

  if (normalized.includes(':')) {
    if (
      normalized === '::' ||
      normalized === '::1' ||
      /^(fc|fd|fe[89ab])/i.test(normalized)
    ) {
      return true;
    }

    const mappedIpv4 = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
    return mappedIpv4 ? isPrivateIpv4(mappedIpv4) : false;
  }

  return isPrivateIpv4(normalized);
}

function assertProductionApiUrl(apiUrl) {
  let parsed;
  try {
    parsed = new URL(apiUrl);
  } catch {
    throw new Error('EXPO_PUBLIC_API_URL must be a valid URL');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('EXPO_PUBLIC_API_URL must use HTTPS for production builds');
  }

  if (isLocalOrPrivateHost(parsed.hostname)) {
    throw new Error('EXPO_PUBLIC_API_URL must not target a local or private host');
  }
}

function resolveApiUrl({ configuredApiUrl, easBuildProfile, nodeEnv }) {
  const apiUrl = configuredApiUrl?.trim();
  const releaseHost = RELEASE_API_HOSTS[easBuildProfile];
  const expectedUrl = releaseHost ? `https://${releaseHost}/api/v1` : undefined;
  const isProduction = Boolean(expectedUrl) || nodeEnv === 'production';

  if (!isProduction) {
    return apiUrl || DEVELOPMENT_API_URL;
  }

  if (!apiUrl) {
    throw new Error('EXPO_PUBLIC_API_URL is required for production builds');
  }

  assertProductionApiUrl(apiUrl);
  if (expectedUrl && apiUrl !== expectedUrl) {
    throw new Error(`EXPO_PUBLIC_API_URL must match ${easBuildProfile}: ${expectedUrl}`);
  }
  return apiUrl;
}

function resolveIosBuildNumber(value) {
  if (value === undefined) return undefined;
  if (!/^[1-9]\d{0,3}$/.test(value)) {
    throw new Error('IOS_BUILD_NUMBER must be an integer from 1 to 9999');
  }
  return value;
}

module.exports = { assertProductionApiUrl, resolveApiUrl, resolveIosBuildNumber };
