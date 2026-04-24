import { getEmailConfig } from '../email.config.js';
import { renderTemplate } from './base.template.js';

/** Group admins for that group receive this when a member submits a manual transfer + proof. */
export function renderManualDepositPendingGroupAdminEmail(
  groupName: string,
  memberName: string,
  memberEmail: string,
  amount: string,
  currency: string,
  depositId: string,
  groupId: string,
): string {
  const { appName, frontendUrl } = getEmailConfig();
  const groupUrl = `${frontendUrl}/dashboard/groups/${encodeURIComponent(groupId)}`;
  const safe = (s: string) => escapeHtml(s);
  const bodyHtml = `
    <h2 style="color: #0E7A4D; margin-bottom: 20px;">Manual payment to verify</h2>
    <p><strong>${safe(memberName)}</strong> (<a href="mailto:${safe(memberEmail)}">${safe(memberEmail)}</a>)</p>
    <p>submitted a <strong>manual bank transfer</strong> in <strong>${safe(groupName)}</strong> for <strong>${safe(amount)} ${safe(currency)}</strong>.</p>
    <p style="font-size: 14px; color: #555;">Reference: <code style="background:#f5f5f5;padding:2px 6px;border-radius:4px;">${safe(depositId)}</code></p>
    <p>Sign in to ${safe(appName)} as a <strong>group admin</strong> for this team, open the group, then confirm or reject the payment after reviewing the proof.</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${safe(groupUrl)}" style="background-color: #0E7A4D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Open group</a>
    </div>
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
