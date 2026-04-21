import { renderTemplate } from './base.template.js';

export function renderVerificationEmail(otp: string, name?: string): string {
  const greeting = name ? `Hello ${name},` : 'Hello,';
  const expirationMinutes = parseInt(
    process.env.OTP_EXPIRATION_MINUTES || '5',
    10,
  );

  const bodyHtml = `
    <h2 style="color: #0E7A4D; margin-bottom: 20px;">Email Verification</h2>
    <p>${greeting}</p>
    <p>Thank you for signing up! Please use the following code to verify your email address:</p>
    <div style="background-color: #f0f9ff; border: 2px solid #0E7A4D; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0E7A4D; font-family: 'Courier New', monospace;">
        ${otp}
      </div>
    </div>
    <p style="color: #666; font-size: 14px;">This code will expire in ${expirationMinutes} minutes.</p>
    <p style="color: #666; font-size: 14px; margin-top: 20px;">If you didn't create an account, please ignore this email.</p>
  `;

  return renderTemplate(bodyHtml);
}
