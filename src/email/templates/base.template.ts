import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TemplateOptions } from '../types.js';

let headerTemplate: string | null = null;
let footerTemplate: string | null = null;

function loadTemplates(): void {
  if (!headerTemplate || !footerTemplate) {
    const templatesDir = join(__dirname);
    try {
      headerTemplate = readFileSync(
        join(templatesDir, 'header.template.html'),
        'utf-8',
      );
      footerTemplate = readFileSync(
        join(templatesDir, 'footer.template.html'),
        'utf-8',
      );
    } catch (error) {
      throw new Error(
        `Failed to load email templates: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

function replaceVariables(
  template: string,
  variables: Record<string, unknown>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    let stringValue: string;
    if (value === null || value === undefined) {
      stringValue = '';
    } else if (typeof value === 'string') {
      stringValue = value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      stringValue = String(value);
    } else {
      stringValue = JSON.stringify(value);
    }
    result = result.replace(regex, stringValue);
  }
  return result;
}

export function renderTemplate(
  bodyHtml: string,
  options?: TemplateOptions,
): string {
  loadTemplates();

  const appName = process.env.APP_NAME || 'Fasta';
  const logoUrl = process.env.APP_LOGO_URL || '';
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${appName}" class="logo-img" />`
    : `<p class="logo-text">${appName}</p>`;

  const defaultOptions: TemplateOptions = {
    appName,
    appUrl: process.env.APP_URL || 'http://localhost:4000',
    year: new Date().getFullYear(),
    subject: `Email from ${appName}`,
    logoHtml,
    ...options,
  };

  const header = replaceVariables(headerTemplate!, defaultOptions);
  const footer = replaceVariables(footerTemplate!, defaultOptions);

  return `${header}${bodyHtml}${footer}`;
}
