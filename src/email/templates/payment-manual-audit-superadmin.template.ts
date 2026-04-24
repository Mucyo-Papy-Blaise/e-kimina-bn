import { getEmailConfig } from '../email.config.js';
import { renderTemplate } from './base.template.js';

/** Other group admins in the same team get an audit when a peer confirms or rejects a manual payment. */
export function renderManualDepositAuditGroupAdminEmail(
  groupName: string,
  kind: 'CONFIRMED' | 'REJECTED',
  memberName: string,
  amount: string,
  currency: string,
  depositId: string,
  reason: string | null,
  reviewerName: string,
): string {
  const { appName } = getEmailConfig();
  const safe = (s: string) => escapeHtml(s);
  const isReject = kind === 'REJECTED';
  const title = isReject ? 'Manual payment rejected' : 'Manual payment confirmed';
  const lead = isReject
    ? `A group admin <strong>rejected</strong> a manual deposit in <strong>${safe(groupName)}</strong>.`
    : `A group admin <strong>confirmed</strong> a manual deposit in <strong>${safe(groupName)}</strong>.`;
  const reasonBlock =
    isReject && reason
      ? `<p style="margin: 16px 0; padding: 12px; background: #f5f5f5; border-radius: 6px; font-size: 14px;"><strong>Rejection reason (sent to the member):</strong><br/>${safe(reason)}</p>`
      : '';

  const bodyHtml = `
    <h2 style="color: #333; margin-bottom: 16px;">${title}</h2>
    <p>${lead}</p>
    <ul style="line-height: 1.6;">
      <li>Member: <strong>${safe(memberName)}</strong></li>
      <li>Amount: <strong>${safe(amount)} ${safe(currency)}</strong></li>
      <li>Deposit id: <code style="background:#f5f5f5;padding:2px 6px;border-radius:4px;">${safe(depositId)}</code></li>
      <li>Acting group admin: <strong>${safe(reviewerName)}</strong></li>
    </ul>
    ${reasonBlock}
    <p style="color: #666; font-size: 14px; margin-top: 20px;">This is an audit copy for the other group admins in ${safe(appName)}.</p>
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
