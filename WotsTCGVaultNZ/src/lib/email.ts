import { Resend } from "resend";
import { SITE_NAME } from "@/lib/constants";

/**
 * Transactional email via Resend. Falls back to console logging when
 * RESEND_API_KEY is unset so auth/order flows keep working in local dev
 * without a real provider configured.
 */
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM ?? `${SITE_NAME} <no-reply@wotstcgvault.co.nz>`;

export async function sendEmail(opts: { to: string; subject: string; html: string }) {
  if (!resend) {
    console.log(`[email:dev-fallback] To: ${opts.to} | Subject: ${opts.subject}`);
    return { id: "dev-fallback" };
  }
  return resend.emails.send({ from: FROM, to: opts.to, subject: opts.subject, html: opts.html });
}

export function verifyEmailTemplate(name: string, verifyUrl: string) {
  return `
    <div style="font-family:sans-serif;background:#0a0a0a;color:#f4f4f4;padding:32px;">
      <h1 style="color:#d4af37;">${SITE_NAME}</h1>
      <p>Kia ora ${name},</p>
      <p>Confirm your email address to finish setting up your account.</p>
      <p><a href="${verifyUrl}" style="background:#d4af37;color:#0a0a0a;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Verify email</a></p>
      <p style="color:#999;font-size:12px;">If you didn't create this account, you can ignore this email.</p>
    </div>`;
}

export function resetPasswordTemplate(name: string, resetUrl: string) {
  return `
    <div style="font-family:sans-serif;background:#0a0a0a;color:#f4f4f4;padding:32px;">
      <h1 style="color:#d4af37;">${SITE_NAME}</h1>
      <p>Kia ora ${name},</p>
      <p>We received a request to reset your password. This link expires in 1 hour.</p>
      <p><a href="${resetUrl}" style="background:#d4af37;color:#0a0a0a;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Reset password</a></p>
      <p style="color:#999;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
    </div>`;
}

export function orderUpdateTemplate(name: string, message: string, orderUrl: string) {
  return `
    <div style="font-family:sans-serif;background:#0a0a0a;color:#f4f4f4;padding:32px;">
      <h1 style="color:#d4af37;">${SITE_NAME}</h1>
      <p>Kia ora ${name},</p>
      <p>${message}</p>
      <p><a href="${orderUrl}" style="background:#d4af37;color:#0a0a0a;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">View order</a></p>
    </div>`;
}
