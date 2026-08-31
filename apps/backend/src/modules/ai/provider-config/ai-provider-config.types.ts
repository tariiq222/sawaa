export enum AiProvider {
  OPENROUTER = 'OPENROUTER',
  OPENAI = 'OPENAI',
  MINIMAX = 'MINIMAX',
}

export enum AiConnectionStatus {
  NOT_CONFIGURED = 'NOT_CONFIGURED',
  CONNECTED = 'CONNECTED',
  FAILED = 'FAILED',
  RETEST_REQUIRED = 'RETEST_REQUIRED',
}

export interface AiProviderConfigRecord {
  id: string;
  singletonKey: string;
  provider: AiProvider;
  credentialCiphertext: string;
  configVersion: number;
  testedConfigHash: string | null;
  model: string;
  temperature: number;
  maxTokens: number;
  isEnabled: boolean;
  connectionStatus: AiConnectionStatus;
  lastTestedAt: Date | null;
  lastTestOk: boolean | null;
  lastTestErrorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicAiProviderConfig {
  provider: AiProvider;
  model: string;
  temperature: number;
  maxTokens: number;
  isEnabled: boolean;
  connectionStatus: AiConnectionStatus;
  lastTestedAt: Date | null;
  lastTestOk: boolean | null;
  lastTestErrorCode: string | null;
  hasCredential: boolean;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const isDateOrNull = (value: unknown): value is Date | null => value === null || value instanceof Date;

function assertProvider(value: unknown): asserts value is AiProvider {
  if (value !== AiProvider.OPENROUTER && value !== AiProvider.OPENAI && value !== AiProvider.MINIMAX) throw new Error('Invalid provider');
}

function assertModel(provider: AiProvider, model: unknown): asserts model is string {
  const segment = /^[A-Za-z0-9._:-]+$/;
  const isSafeSegment = (value: string): boolean => value !== '.' && value !== '..' && segment.test(value);
  const hasControlCharacter = typeof model === 'string' && [...model].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
  if (typeof model !== 'string' || model.length < 1 || model.length > 200 || /\s/.test(model) || hasControlCharacter) {
    throw new Error('Invalid model');
  }
  const valid = provider === AiProvider.OPENROUTER
    ? model.split('/').length === 2 && model.split('/').every(isSafeSegment)
    : provider === AiProvider.MINIMAX
      ? isSafeSegment(model) && !model.includes('/') && model.startsWith('MiniMax-')
      : isSafeSegment(model) && !model.includes('/');
  if (!valid) throw new Error('Invalid model for provider');
}

/** Parse persisted configuration strictly, rejecting DTOs, class instances, and unknown shapes. */
export const parseAiProviderConfig = (value: unknown): AiProviderConfigRecord => {
  if (!isPlainObject(value)) throw new Error('Configuration must be a plain object');
  const config = value;
  const allowedKeys = new Set([
    'id',
    'singletonKey',
    'provider',
    'credentialCiphertext',
    'configVersion',
    'testedConfigHash',
    'model',
    'temperature',
    'maxTokens',
    'isEnabled',
    'connectionStatus',
    'lastTestedAt',
    'lastTestOk',
    'lastTestErrorCode',
    'createdAt',
    'updatedAt',
  ]);
  if (Object.keys(config).some((key) => !allowedKeys.has(key))) throw new Error('Unknown configuration field');
  assertProvider(config.provider);
  assertModel(config.provider, config.model);
  if (typeof config.id !== 'string' || config.singletonKey !== 'singleton') throw new Error('Invalid configuration identity');
  if (typeof config.credentialCiphertext !== 'string' || config.credentialCiphertext.length < 1 || config.credentialCiphertext.length > 16_384) throw new Error('Invalid credential ciphertext');
  if (config.configVersion !== undefined && (!Number.isInteger(config.configVersion) || (config.configVersion as number) < 0)) throw new Error('Invalid configuration version');
  if (config.testedConfigHash !== undefined && config.testedConfigHash !== null && typeof config.testedConfigHash !== 'string') throw new Error('Invalid tested configuration hash');
  if (typeof config.temperature !== 'number' || !Number.isFinite(config.temperature) || config.temperature < 0 || config.temperature > 2) throw new Error('Invalid temperature');
  if (!Number.isInteger(config.maxTokens) || (config.maxTokens as number) < 1 || (config.maxTokens as number) > 32_000) throw new Error('Invalid maxTokens');
  if (typeof config.isEnabled !== 'boolean' || !Object.values(AiConnectionStatus).includes(config.connectionStatus as AiConnectionStatus)) throw new Error('Invalid configuration status');
  if (config.lastTestOk !== null && typeof config.lastTestOk !== 'boolean') throw new Error('Invalid lastTestOk');
  if (typeof config.lastTestErrorCode !== 'string' && config.lastTestErrorCode !== null) throw new Error('Invalid lastTestErrorCode');
  if (!isDateOrNull(config.lastTestedAt) || !(config.createdAt instanceof Date) || !(config.updatedAt instanceof Date)) throw new Error('Invalid configuration dates');
  return config as unknown as AiProviderConfigRecord;
};

/** Shared provider/model contract used by DTO handlers and runtime. */
export function assertProviderModel(provider: unknown, model: unknown): asserts model is string {
  assertProvider(provider);
  assertModel(provider, model);
}

export const toPublicAiProviderConfig = (value: unknown): PublicAiProviderConfig => {
  const config = parseAiProviderConfig(value);
  return {
    provider: config.provider,
    model: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    isEnabled: config.isEnabled,
    connectionStatus: config.connectionStatus,
    lastTestedAt: config.lastTestedAt,
    lastTestOk: config.lastTestOk,
    lastTestErrorCode: config.lastTestErrorCode,
    hasCredential: config.credentialCiphertext.length > 0,
  };
};
