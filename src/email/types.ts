export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface TemplateOptions {
  appName?: string;
  appUrl?: string;
  year?: number;
  [key: string]: unknown;
}
