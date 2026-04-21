import { renderTemplate } from './base.template.js';

export function renderVendorInvitationEmail(
  vendorName: string,
  role: string,
  inviterName: string,
  invitationToken: string,
  recipientName?: string,
  userExists: boolean = true,
): string {
  const greeting = recipientName ? `Hello ${recipientName},` : 'Hello,';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const acceptanceUrl = `${frontendUrl}/vendor-invitations/${invitationToken}/accept`;
  const registerUrl = `${frontendUrl}/register?invitation=${invitationToken}`;

  const roleDisplay = role.charAt(0) + role.slice(1).toLowerCase();

  const bodyHtml = `
    <h2 style="color: #0E7A4D; margin-bottom: 20px;">Vendor Staff Invitation</h2>
    <p>${greeting}</p>
    <p><strong>${inviterName}</strong> has invited you to join <strong>${vendorName}</strong> as a <strong>${roleDisplay}</strong>.</p>
    ${
      userExists
        ? `<p>Click the button below to accept this invitation:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${acceptanceUrl}" style="background-color: #0E7A4D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Accept Invitation</a>
    </div>
    <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
    <p style="color: #666; font-size: 14px; word-break: break-all;">${acceptanceUrl}</p>`
        : `<p>To accept this invitation, please create an account first:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${registerUrl}" style="background-color: #0E7A4D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Register & Accept</a>
    </div>
    <p style="color: #666; font-size: 14px;">After registering and verifying your email, you'll automatically be added to the vendor.</p>
    <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
    <p style="color: #666; font-size: 14px; word-break: break-all;">${registerUrl}</p>`
    }
    <p style="color: #666; font-size: 14px; margin-top: 20px;">This invitation will expire in 7 days.</p>
    <p style="color: #666; font-size: 14px;">If you didn't expect this invitation, you can safely ignore this email.</p>
  `;

  return renderTemplate(bodyHtml);
}
