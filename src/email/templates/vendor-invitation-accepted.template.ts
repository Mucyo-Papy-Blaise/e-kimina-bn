import { renderTemplate } from './base.template.js';

export function renderVendorInvitationAcceptedEmail(
  vendorName: string,
  role: string,
  vendorSlug: string,
  recipientName?: string,
): string {
  const greeting = recipientName ? `Hello ${recipientName},` : 'Hello,';
  const roleDisplay = role.charAt(0) + role.slice(1).toLowerCase();
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const vendorUrl = `${frontendUrl}/console/${vendorSlug}`;

  const bodyHtml = `
    <h2 style="color: #10b981; margin-bottom: 20px;">Welcome to ${vendorName}!</h2>
    <p>${greeting}</p>
    <p>You have successfully accepted the invitation to join <strong>${vendorName}</strong> as a <strong>${roleDisplay}</strong>.</p>
    <p>You can now access your vendor dashboard and start managing your vendor operations.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${vendorUrl}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Go to Vendor Dashboard</a>
    </div>
    <p style="color: #666; font-size: 14px;">If you have any questions, please contact your vendor administrator.</p>
  `;

  return renderTemplate(bodyHtml);
}
