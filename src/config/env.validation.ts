type EnvRecord = Record<string, unknown>;

const allowedNodeEnvs = ['development', 'test', 'production'] as const;

function asString(value: unknown, fallback?: string): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new Error('Expected a non-empty string environment variable.');
}

function asPort(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return port;
}

function asBooleanString(
  value: unknown,
  fallback: 'true' | 'false',
): 'true' | 'false' {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (value === 'true' || value === 'false') {
    return value;
  }

  throw new Error('SWAGGER_ENABLED must be "true" or "false".');
}

function asPositiveInteger(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('Expected a positive integer environment variable.');
  }

  return parsed;
}

export function validateEnv(config: EnvRecord) {
  const nodeEnv = asString(config.NODE_ENV, 'development');

  if (!allowedNodeEnvs.includes(nodeEnv as (typeof allowedNodeEnvs)[number])) {
    throw new Error(`NODE_ENV must be one of: ${allowedNodeEnvs.join(', ')}.`);
  }

  return {
    APP_NAME: asString(config.APP_NAME, 'nest-app'),
    APP_VERSION: asString(config.APP_VERSION, '0.0.1'),
    NODE_ENV: nodeEnv,
    PORT: asPort(config.PORT, 4000),
    API_PREFIX: asString(config.API_PREFIX, 'api'),
    SWAGGER_ENABLED: asBooleanString(config.SWAGGER_ENABLED, 'true'),
    DATABASE_URL: asString(config.DATABASE_URL),
    JWT_SECRET: asString(config.JWT_SECRET),
    JWT_EXPIRES_IN: asString(config.JWT_EXPIRES_IN, '1d'),
    BCRYPT_SALT_ROUNDS: asPositiveInteger(config.BCRYPT_SALT_ROUNDS, 12),
    CLOUDINARY_CLOUD_NAME: asString(config.CLOUDINARY_CLOUD_NAME, ''),
    CLOUDINARY_API_KEY: asString(config.CLOUDINARY_API_KEY, ''),
    CLOUDINARY_API_SECRET: asString(config.CLOUDINARY_API_SECRET, ''),
    CLOUDINARY_FOLDER: asString(config.CLOUDINARY_FOLDER, 'e-kimina'),
  };
}
