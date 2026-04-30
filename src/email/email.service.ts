import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { getEmailConfig } from './email.config.js';
import { EmailOptions } from './types.js';
import { renderVerificationEmail } from './templates/email-verification.template.js';
import { renderPasswordResetEmail } from './templates/password-reset.template.js';
import { renderMemberInvitationEmail } from './templates/member-invitation.template.js';
import { renderTreasurerInvitationEmail } from './templates/treasurer-invitation.template.js';
import { renderVendorCreatedEmail } from './templates/vendor-created.template.js';
import { renderPaymentDepositConfirmedEmail } from './templates/payment-deposit-confirmed.template.js';
import { renderPaymentDepositRejectedEmail } from './templates/payment-deposit-rejected.template.js';
import { renderManualDepositAuditGroupAdminEmail } from './templates/payment-manual-audit-superadmin.template.js';
import { renderManualDepositPendingGroupAdminEmail } from './templates/payment-manual-pending-superadmin.template.js';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;

  constructor() {
    const config = getEmailConfig();

    this.transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.auth,
      family: 4, // 👈 Force IPv4
      tls: {
        rejectUnauthorized: false,
      },
    } as any); // 👈 bypass TypeScript strict typing

    if (config.smtp.host.trim()) {
      void this.verifyConnection();
    } else {
      this.logger.warn(
        'SMTP not configured (SMTP_HOST is empty). Set SMTP_* in .env to send email.',
      );
    }
  }

  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified');
    } catch (error) {
      this.logger.error(
        `SMTP connection failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    const config = getEmailConfig();

    if (!config.smtp.host.trim()) {
      throw new Error(
        'SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM_EMAIL, and SMTP_FROM_NAME in .env.',
      );
    }

    try {
      const mailOptions = {
        from: `"${config.smtp.from.name}" <${config.smtp.from.email}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.htmlToText(options.html),
      };

      const info = await this.transporter.sendMail(mailOptions);

      this.logger.log(
        `Email sent to=${options.to} subject=${options.subject} messageId=${info.messageId ?? ''}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send email to=${options.to} subject=${options.subject}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new Error(
        `Failed to send email: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async sendVerificationEmail(
    email: string,
    otp: string,
    name?: string,
  ): Promise<void> {
    const html = renderVerificationEmail(otp, name);
    const config = getEmailConfig();

    await this.sendEmail({
      to: email,
      subject: `Verify your ${config.appName} account`,
      html,
    });
  }

  async sendVendorCreatedEmail(
    email: string,
    vendorName: string,
    vendorSlug: string,
    name?: string,
    password?: string,
  ): Promise<void> {
    const config = getEmailConfig();
    const html = renderVendorCreatedEmail(
      vendorName,
      vendorSlug,
      config.frontendUrl,
      email,
      name,
      password,
    );

    await this.sendEmail({
      to: email,
      subject: `Welcome to ${config.appName} - ${vendorName}`,
      html,
    });
  }

  async sendTreasurerInvitationEmail(
    email: string,
    invitationToken: string,
    groupName: string,
  ): Promise<void> {
    const html = renderTreasurerInvitationEmail(invitationToken, groupName);
    const config = getEmailConfig();

    await this.sendEmail({
      to: email,
      subject: `Treasurer invitation — ${groupName} (${config.appName})`,
      html,
    });
  }

  async sendMemberInvitationEmail(
    email: string,
    invitationToken: string,
    groupName: string,
  ): Promise<void> {
    const html = renderMemberInvitationEmail(invitationToken, groupName);
    const config = getEmailConfig();

    await this.sendEmail({
      to: email,
      subject: `Team invitation — ${groupName} (${config.appName})`,
      html,
    });
  }

  async sendPasswordResetEmail(
    email: string,
    otp: string,
    name?: string,
  ): Promise<void> {
    const html = renderPasswordResetEmail(otp, email, name);
    const config = getEmailConfig();
    await this.sendEmail({
      to: email,
      subject: `Reset your ${config.appName} password`,
      html,
    });
  }

  async sendManualDepositConfirmedEmail(
    toEmail: string,
    args: {
      memberName: string;
      groupName: string;
      amount: string;
      currency: string;
    },
  ): Promise<void> {
    const config = getEmailConfig();
    const html = renderPaymentDepositConfirmedEmail(
      args.memberName,
      args.groupName,
      args.amount,
      args.currency,
    );
    await this.sendEmail({
      to: toEmail,
      subject: `Payment confirmed — ${args.groupName} (${config.appName})`,
      html,
    });
  }

  async sendManualDepositRejectedEmail(
    toEmail: string,
    args: {
      memberName: string;
      groupName: string;
      amount: string;
      currency: string;
      reason: string | null;
    },
  ): Promise<void> {
    const config = getEmailConfig();
    const html = renderPaymentDepositRejectedEmail(
      args.memberName,
      args.groupName,
      args.amount,
      args.currency,
      args.reason,
    );
    await this.sendEmail({
      to: toEmail,
      subject: `Payment not accepted — ${args.groupName} (${config.appName})`,
      html,
    });
  }

  /** All group admins in that team — when a member submits a manual transfer + proof. */
  async sendManualDepositPendingToGroupAdmins(
    toEmails: string[],
    args: {
      groupName: string;
      memberName: string;
      memberEmail: string;
      amount: string;
      currency: string;
      depositId: string;
      groupId: string;
    },
  ): Promise<void> {
    if (toEmails.length === 0) {
      this.logger.warn(
        'No group admin emails to notify for pending manual deposit (assign a GROUP_ADMIN in this group, or add their email to an active user).',
      );
      return;
    }
    const config = getEmailConfig();
    const html = renderManualDepositPendingGroupAdminEmail(
      args.groupName,
      args.memberName,
      args.memberEmail,
      args.amount,
      args.currency,
      args.depositId,
      args.groupId,
    );
    const subject = `Manual payment to verify — ${args.groupName} (${config.appName})`;
    for (const to of toEmails) {
      try {
        await this.sendEmail({ to, subject, html });
      } catch (e) {
        this.logger.error(
          `Failed to email group admin at ${to}: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }
  }

  /** Other group admins in the team (excluding the actor) get an audit copy. */
  async sendManualDepositAuditToGroupAdmins(
    toEmails: string[],
    args: {
      groupName: string;
      kind: 'CONFIRMED' | 'REJECTED';
      memberName: string;
      amount: string;
      currency: string;
      depositId: string;
      reason: string | null;
      reviewerName: string;
    },
  ): Promise<void> {
    if (toEmails.length === 0) {
      return;
    }
    const config = getEmailConfig();
    const subjBase =
      args.kind === 'CONFIRMED'
        ? 'Manual payment confirmed'
        : 'Manual payment rejected';
    const subject = `${subjBase} (audit) — ${args.groupName} (${config.appName})`;
    const html = renderManualDepositAuditGroupAdminEmail(
      args.groupName,
      args.kind,
      args.memberName,
      args.amount,
      args.currency,
      args.depositId,
      args.reason,
      args.reviewerName,
    );
    for (const to of toEmails) {
      try {
        await this.sendEmail({ to, subject, html });
      } catch (e) {
        this.logger.error(
          `Failed to send audit email to group admin: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
