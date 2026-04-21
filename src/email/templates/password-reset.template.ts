import { renderTemplate } from './base.template.js';

/**
 * Encodes a string to base64url format (URL-safe base64)
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function renderPasswordResetEmail(
  otp: string,
  email: string,
  name?: string,
): string {
  const greeting = name ? `Hello ${name},` : 'Hello,';
  const expirationMinutes = parseInt(
    process.env.OTP_EXPIRATION_MINUTES || '5',
    10,
  );

  // Generate magic link URL
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const encodedOtp = base64UrlEncode(otp);
  const encodedEmail = base64UrlEncode(email);
  const resetLink = `${frontendUrl}/reset-password?otp=${encodedOtp}&email=${encodedEmail}`;

  const bodyHtml = `
    <h2 style="color: #0E7A4D; margin-bottom: 20px;">Password Reset Request</h2>
    <p>${greeting}</p>
    <p>We received a request to reset your password. Use either the verification code or the link below.</p>

    <!-- 1. OTP Code -->
    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 24px; margin: 24px 0;">
      <p style="font-weight: 600; margin: 0 0 12px 0; color: #334155;">1. Your Verification Code</p>
      <div style="text-align: center;">
        <div style="display: inline-block; background-color: #ffffff; border: 2px dashed #0E7A4D; border-radius: 8px; padding: 16px 32px;">
          <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0E7A4D;">${otp}</span>
        </div>
      </div>
      <p style="text-align: center; color: #64748b; font-size: 13px; margin: 12px 0 0 0;">Copy this code and enter it on the E-Kimina reset password page</p>
    </div>

    <!-- 2. Reset Link -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin: 24px 0;">
      <p style="font-weight: 600; margin: 0 0 16px 0; color: #334155;">2. Or Use This Link</p>
      <div style="text-align: center;">
        <a href="${resetLink}" style="display: inline-block; background-color: #0E7A4D; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
          Reset Password
        </a>
      </div>
      <p style="text-align: center; color: #64748b; font-size: 13px; margin: 12px 0 0 0;">Tap the button or copy the link below into your browser:</p>
      <p style="color: #0E7A4D; font-size: 12px; word-break: break-all; text-align: center; margin: 8px 0 0 0;">${resetLink}</p>
    </div>

    <p style="color: #666; font-size: 14px;">This code and link expire in ${expirationMinutes} minutes.</p>
    <p style="color: #666; font-size: 14px; margin-top: 16px;">If you didn't request this, you can safely ignore this email.</p>
  `;

  return renderTemplate(bodyHtml);
}
