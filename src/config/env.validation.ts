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

function requireString(name: string, value: unknown): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  throw new Error(
    `${name} is required (set a non-empty value in your .env file).`,
  );
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

function smtpPort(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    throw new Error('SMTP_PORT is required (set it in .env).');
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('SMTP_PORT must be an integer between 1 and 65535.');
  }

  return port;
}

function smtpSecure(value: unknown): boolean {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  throw new Error('SMTP_SECURE must be "true" or "false" (set it in .env).');
}

function isSmtpConfigured(config: EnvRecord): boolean {
  const host = config.SMTP_HOST;
  return typeof host === 'string' && host.trim().length > 0;
}

export function validateEnv(config: EnvRecord) {
  const nodeEnv = asString(config.NODE_ENV, 'development');

  if (!allowedNodeEnvs.includes(nodeEnv as (typeof allowedNodeEnvs)[number])) {
    throw new Error(`NODE_ENV must be one of: ${allowedNodeEnvs.join(', ')}.`);
  }

  const smtpEnabled = isSmtpConfigured(config);

  const smtpBlock = smtpEnabled
    ? {
        SMTP_HOST: requireString('SMTP_HOST', config.SMTP_HOST),
        SMTP_PORT: smtpPort(config.SMTP_PORT),
        SMTP_SECURE: smtpSecure(config.SMTP_SECURE),
        SMTP_USER: requireString('SMTP_USER', config.SMTP_USER),
        SMTP_PASS: requireString('SMTP_PASS', config.SMTP_PASS),
        SMTP_FROM_EMAIL: requireString(
          'SMTP_FROM_EMAIL',
          config.SMTP_FROM_EMAIL,
        ),
        SMTP_FROM_NAME: requireString('SMTP_FROM_NAME', config.SMTP_FROM_NAME),
      }
    : {
        SMTP_HOST: '',
        SMTP_PORT: 0,
        SMTP_SECURE: false,
        SMTP_USER: '',
        SMTP_PASS: '',
        SMTP_FROM_EMAIL: '',
        SMTP_FROM_NAME: '',
      };

  return {
    APP_NAME: asString(config.APP_NAME, 'nest-app'),
    APP_VERSION: asString(config.APP_VERSION, '0.0.1'),
    NODE_ENV: nodeEnv,
    PORT: asPort(config.PORT, 4000),
    API_PREFIX: asString(config.API_PREFIX, 'api'),
    SWAGGER_ENABLED: asBooleanString(config.SWAGGER_ENABLED, 'true'),
    DATABASE_URL: requireString('DATABASE_URL', config.DATABASE_URL),
    JWT_SECRET: requireString('JWT_SECRET', config.JWT_SECRET),
    JWT_EXPIRES_IN: asString(config.JWT_EXPIRES_IN, '1d'),
    BCRYPT_SALT_ROUNDS: asPositiveInteger(config.BCRYPT_SALT_ROUNDS, 12),
    CLOUDINARY_CLOUD_NAME: asString(config.CLOUDINARY_CLOUD_NAME, ''),
    CLOUDINARY_API_KEY: asString(config.CLOUDINARY_API_KEY, ''),
    CLOUDINARY_API_SECRET: asString(config.CLOUDINARY_API_SECRET, ''),
    CLOUDINARY_FOLDER: asString(config.CLOUDINARY_FOLDER, 'e-kimina'),
    ...smtpBlock,
  };
}
