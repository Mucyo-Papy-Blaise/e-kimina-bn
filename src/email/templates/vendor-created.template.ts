import { renderTemplate } from './base.template.js';

export function renderVendorCreatedEmail(
  vendorName: string,
  vendorSlug: string,
  frontendUrl: string,
  ownerEmail: string,
  name?: string,
  password?: string,
): string {
  const greeting = name ? `Hello ${name},` : 'Hello,';
  const loginUrl = `${frontendUrl}/login`;

  const passwordSection = password
    ? `
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: left;">
      <p style="margin-top: 0; font-weight: bold; color: #1e293b;">Your Account Credentials:</p>
      <p style="margin: 5px 0;"><strong>Email:</strong> ${ownerEmail}</p>
      <p style="margin: 5px 0;"><strong>Auto-generated Password:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 16px;">${password}</code></p>
      <p style="margin-bottom: 0; font-size: 12px; color: #64748b; margin-top: 10px;">Please change your password after your first login for security.</p>
    </div>
  `
    : '';

  const bodyHtml = `
    <h2 style="color: #0E7A4D; margin-bottom: 20px;">Welcome to E-KIMINA!</h2>
    <p>${greeting}</p>
    <p>We are excited to inform you that a new vendor, <strong>${vendorName}</strong>, has been successfully created and assigned to you.</p>

    ${passwordSection}

    <p>You can now start managing your products, orders, and staff through your vendor dashboard.</p>

    <div style="text-align: center; margin: 40px 0;">
      <a href="${loginUrl}" style="background-color: #0E7A4D; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">Login to Dashboard</a>
    </div>

    <p style="color: #666; font-size: 14px;">If the button above doesn't work, you can also copy and paste this link into your browser:</p>
    <p style="color: #0E7A4D; font-size: 14px; word-break: break-all;">${loginUrl}</p>

    <p style="color: #666; font-size: 14px; margin-top: 30px;">Best regards,<br>The E-KIMINA Team</p>
  `;

  return renderTemplate(bodyHtml);
}
