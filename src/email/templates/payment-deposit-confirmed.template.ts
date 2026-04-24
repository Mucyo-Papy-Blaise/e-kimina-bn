import { getEmailConfig } from '../email.config.js';
import { renderTemplate } from './base.template.js';

export function renderPaymentDepositConfirmedEmail(
  memberName: string,
  groupName: string,
  amount: string,
  currency: string,
): string {
  const { frontendUrl, appName } = getEmailConfig();
  const safeName = escapeHtml(memberName);
  const safeGroup = escapeHtml(groupName);
  const safeAmount = escapeHtml(`${amount} ${currency}`);

  const bodyHtml = `
    <h2 style="color: #0E7A4D; margin-bottom: 20px;">Payment confirmed</h2>
    <p>Hello ${safeName || 'there'},</p>
    <p>Your manual deposit for <strong>${safeGroup}</strong> has been <strong>confirmed</strong> by a group admin.</p>
    <p style="font-size: 16px; margin: 24px 0;"><strong>Amount:</strong> ${safeAmount}</p>
    <p>Your contribution balance has been updated in ${escapeHtml(appName)}.</p>
    <p style="margin-top: 24px;">
      <a href="${escapeHtml(frontendUrl)}/dashboard/groups" style="color: #0E7A4D; font-weight: 600;">Open your groups</a>
    </p>
    <p style="color: #666; font-size: 14px; margin-top: 24px;">If you have questions, contact your group treasurer or admin.</p>
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
