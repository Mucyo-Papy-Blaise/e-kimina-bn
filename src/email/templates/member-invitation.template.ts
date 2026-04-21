import { getEmailConfig } from '../email.config.js';
import { renderTemplate } from './base.template.js';

export function renderMemberInvitationEmail(
  invitationToken: string,
  groupName: string,
): string {
  const { frontendUrl } = getEmailConfig();
  const registerUrl = `${frontendUrl}/register?invitation=${encodeURIComponent(invitationToken)}`;

  const bodyHtml = `
    <h2 style="color: #0E7A4D; margin-bottom: 20px;">Team invitation</h2>
    <p>Hello,</p>
    <p>You have been invited to join <strong>${escapeHtml(groupName)}</strong> on <strong>E-Kimina</strong> as a <strong>team member</strong>.</p>
    <p>Create your account using the link below. Your account stays inactive until you finish registration from this link.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${registerUrl}" style="background-color: #0E7A4D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Register &amp; join</a>
    </div>
    <p style="color: #666; font-size: 14px;">The registration form will prefill your email (you cannot change it). After you register, you are part of the group and can sign in.</p>
    <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
    <p style="color: #666; font-size: 14px; word-break: break-all;">${registerUrl}</p>
    <p style="color: #666; font-size: 14px; margin-top: 20px;">This invitation expires in 7 days.</p>
    <p style="color: #666; font-size: 14px;">If you did not expect this invitation, you can ignore this email.</p>
  `;

  return renderTemplate(bodyHtml);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
