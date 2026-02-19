// ==========================================
// Email Utility - Burmese Digital Store
// Supports Resend HTTP API or SMTP fallback
// ==========================================

const FROM_NAME = process.env.EMAIL_FROM_NAME || 'Burmese Digital Store';
const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@burmesedigital.store';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send email via Resend HTTP API (preferred — no port blocking issues)
 * Falls back to SMTP if RESEND_API_KEY is not set.
 */
export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (resendApiKey) {
    // Resend HTTP API — works everywhere, no port issues
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(`Resend API error: ${res.status} ${JSON.stringify(error)}`);
    }
    return;
  }

  // SMTP fallback (for Gmail, Mailgun, etc.)
  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.default.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to,
    subject,
    html,
  });
}

/**
 * Send a password reset email with a secure link.
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </head>
    <body style="margin:0;padding:0;background:#0a0a0f;font-family:Arial,Helvetica,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 0;">
        <tr>
          <td align="center">
            <table width="480" cellpadding="0" cellspacing="0" style="background:#13131a;border-radius:16px;border:1px solid rgba(139,92,246,0.2);overflow:hidden;">
              <!-- Header -->
              <tr>
                <td style="background:linear-gradient(135deg,#7c3aed,#06b6d4);padding:32px 40px;text-align:center;">
                  <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">
                    🔐 Password Reset
                  </h1>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding:40px;">
                  <p style="color:#d1d5db;font-size:16px;line-height:1.6;margin:0 0 20px;">
                    We received a request to reset your password for your <strong style="color:#a78bfa;">Burmese Digital Store</strong> account.
                  </p>
                  <p style="color:#d1d5db;font-size:16px;line-height:1.6;margin:0 0 30px;">
                    Click the button below to create a new password. This link expires in <strong style="color:#22d3ee;">1 hour</strong>.
                  </p>
                  <!-- Button -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center">
                        <a href="${resetUrl}"
                           style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#06b6d4);color:#fff;text-decoration:none;padding:14px 40px;border-radius:12px;font-size:16px;font-weight:600;letter-spacing:0.5px;">
                          Reset Password
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:30px 0 0;border-top:1px solid rgba(255,255,255,0.05);padding-top:20px;">
                    If you didn't request this, you can safely ignore this email. Your password won't be changed.
                  </p>
                  <p style="color:#6b7280;font-size:12px;line-height:1.5;margin:15px 0 0;word-break:break-all;">
                    If the button doesn't work, copy and paste this link:<br/>
                    <a href="${resetUrl}" style="color:#a78bfa;text-decoration:underline;">${resetUrl}</a>
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding:20px 40px;background:rgba(0,0,0,0.3);text-align:center;">
                  <p style="color:#6b7280;font-size:12px;margin:0;">
                    © ${new Date().getFullYear()} Burmese Digital Store. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: 'Password Reset - Burmese Digital Store',
    html,
  });
}

/**
 * Send email verification link after registration.
 * Token expires in 24 hours.
 */
export async function sendVerificationEmail(
  email: string,
  verificationToken: string
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </head>
    <body style="margin:0;padding:0;background:#0a0a0f;font-family:Arial,Helvetica,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 0;">
        <tr>
          <td align="center">
            <table width="480" cellpadding="0" cellspacing="0" style="background:#13131a;border-radius:16px;border:1px solid rgba(139,92,246,0.2);overflow:hidden;">
              <!-- Header -->
              <tr>
                <td style="background:linear-gradient(135deg,#7c3aed,#06b6d4);padding:32px 40px;text-align:center;">
                  <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">
                    ✉️ Verify Your Email
                  </h1>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding:40px;">
                  <p style="color:#d1d5db;font-size:16px;line-height:1.6;margin:0 0 20px;">
                    Welcome to <strong style="color:#a78bfa;">Burmese Digital Store</strong>! Please verify your email address to start placing orders.
                  </p>
                  <p style="color:#d1d5db;font-size:16px;line-height:1.6;margin:0 0 30px;">
                    Click the button below to verify. This link expires in <strong style="color:#22d3ee;">24 hours</strong>.
                  </p>
                  <!-- Button -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center">
                        <a href="${verifyUrl}"
                           style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#06b6d4);color:#fff;text-decoration:none;padding:14px 40px;border-radius:12px;font-size:16px;font-weight:600;letter-spacing:0.5px;">
                          Verify Email
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:30px 0 0;border-top:1px solid rgba(255,255,255,0.05);padding-top:20px;">
                    If you didn't create an account, you can safely ignore this email.
                  </p>
                  <p style="color:#6b7280;font-size:12px;line-height:1.5;margin:15px 0 0;word-break:break-all;">
                    If the button doesn't work, copy and paste this link:<br/>
                    <a href="${verifyUrl}" style="color:#a78bfa;text-decoration:underline;">${verifyUrl}</a>
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding:20px 40px;background:rgba(0,0,0,0.3);text-align:center;">
                  <p style="color:#6b7280;font-size:12px;margin:0;">
                    © ${new Date().getFullYear()} Burmese Digital Store. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: 'Verify Your Email - Burmese Digital Store',
    html,
  });
}

/**
 * Send VPN expiry reminder email.
 */
export async function sendVpnExpiryReminderEmail(
  email: string,
  params: {
    userName: string;
    orderNumber: string;
    planDescription: string;
    expiryDate: Date;
    daysRemaining: number;
  }
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const vpnUrl = `${baseUrl}/vpn`;
  const formattedDate = params.expiryDate.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const urgencyColor = params.daysRemaining <= 1 ? '#ef4444' : params.daysRemaining <= 3 ? '#f59e0b' : '#06b6d4';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </head>
    <body style="margin:0;padding:0;background:#0a0a0f;font-family:Arial,Helvetica,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 0;">
        <tr>
          <td align="center">
            <table width="480" cellpadding="0" cellspacing="0" style="background:#13131a;border-radius:16px;border:1px solid rgba(139,92,246,0.2);overflow:hidden;">
              <!-- Header -->
              <tr>
                <td style="background:linear-gradient(135deg,#7c3aed,#06b6d4);padding:32px 40px;text-align:center;">
                  <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">
                    ⏰ VPN Expiry Reminder
                  </h1>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding:40px;">
                  <p style="color:#d1d5db;font-size:16px;line-height:1.6;margin:0 0 20px;">
                    Hi <strong style="color:#a78bfa;">${params.userName}</strong>,
                  </p>
                  <p style="color:#d1d5db;font-size:16px;line-height:1.6;margin:0 0 20px;">
                    Your VPN key for order <strong style="color:#22d3ee;">${params.orderNumber}</strong> is expiring soon.
                  </p>

                  <!-- Info Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(124,58,237,0.1);border:1px solid rgba(124,58,237,0.2);border-radius:12px;margin:0 0 24px;">
                    <tr>
                      <td style="padding:20px;">
                        <p style="color:#9ca3af;font-size:13px;margin:0 0 8px;">Plan</p>
                        <p style="color:#e2e8f0;font-size:15px;font-weight:600;margin:0 0 12px;">${params.planDescription}</p>
                        <p style="color:#9ca3af;font-size:13px;margin:0 0 8px;">Expires On</p>
                        <p style="color:${urgencyColor};font-size:15px;font-weight:600;margin:0;">${formattedDate} (${params.daysRemaining} day${params.daysRemaining > 1 ? 's' : ''} remaining)</p>
                      </td>
                    </tr>
                  </table>

                  <p style="color:#d1d5db;font-size:16px;line-height:1.6;margin:0 0 30px;">
                    Renew now to keep your VPN connection active and uninterrupted.
                  </p>
                  <!-- Button -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center">
                        <a href="${vpnUrl}"
                           style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#06b6d4);color:#fff;text-decoration:none;padding:14px 40px;border-radius:12px;font-size:16px;font-weight:600;letter-spacing:0.5px;">
                          Renew VPN
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:30px 0 0;border-top:1px solid rgba(255,255,255,0.05);padding-top:20px;">
                    If your key has already expired, you can purchase a new plan from our VPN page.
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding:20px 40px;background:rgba(0,0,0,0.3);text-align:center;">
                  <p style="color:#6b7280;font-size:12px;margin:0;">
                    &copy; ${new Date().getFullYear()} Burmese Digital Store. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: `VPN Expiring in ${params.daysRemaining} Day${params.daysRemaining > 1 ? 's' : ''} - Burmese Digital Store`,
    html,
  });
}
