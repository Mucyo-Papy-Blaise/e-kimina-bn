export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: {
    email: string;
    name: string;
  };
}

export interface EmailConfig {
  smtp: SmtpConfig;
  appUrl: string;
  frontendUrl: string;
  appName: string;
}

/**
 * SMTP settings are read only from environment variables (see `validateEnv`).
 * Do not hardcode host/port/credentials here — use `.env` (`SMTP_HOST`, etc.).
 */
export function getEmailConfig(): EmailConfig {
  return {
    smtp: {
      host: process.env.SMTP_HOST ?? '',
      port: (() => {
        const n = parseInt(process.env.SMTP_PORT ?? '', 10);
        return Number.isFinite(n) ? n : 0;
      })(),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER ?? '',
        pass: process.env.SMTP_PASS ?? '',
      },
      from: {
        email: process.env.SMTP_FROM_EMAIL ?? '',
        name: process.env.SMTP_FROM_NAME ?? '',
      },
    },
    appUrl: process.env.APP_URL || 'http://localhost:4000',
    frontendUrl:
      process.env.FRONTEND_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000',
    appName: process.env.APP_NAME || 'nest-app',
  };
}
