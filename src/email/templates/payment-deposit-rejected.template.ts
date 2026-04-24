import { getEmailConfig } from '../email.config.js';
import { renderTemplate } from './base.template.js';

export function renderPaymentDepositRejectedEmail(
  memberName: string,
  groupName: string,
  amount: string,
  currency: string,
  reason: string | null,
): string {
  const { frontendUrl, appName } = getEmailConfig();
  const safeName = escapeHtml(memberName);
  const safeGroup = escapeHtml(groupName);
  const safeAmount = escapeHtml(`${amount} ${currency}`);
  const reasonBlock = reason
    ? `<p style="margin: 20px 0; padding: 12px; background: #f5f5f5; border-radius: 6px; font-size: 14px;"><strong>Note from admin:</strong><br/>${escapeHtml(
        reason,
      )}</p>`
    : '';

  const bodyHtml = `
    <h2 style="color: #b91c1c; margin-bottom: 20px;">Payment not accepted</h2>
    <p>Hello ${safeName || 'there'},</p>
    <p>Your manual deposit proof for <strong>${safeGroup}</strong> (reported as <strong>${safeAmount}</strong>) was <strong>not accepted</strong>.</p>
    ${reasonBlock}
    <p>Please check your bank or mobile transfer details, then submit a new payment with a clear receipt or screenshot if you still need this payment recorded.</p>
    <p style="margin-top: 24px;">
      <a href="${escapeHtml(frontendUrl)}/dashboard/groups" style="color: #0E7A4D; font-weight: 600;">Open ${escapeHtml(appName)}</a>
    </p>
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
