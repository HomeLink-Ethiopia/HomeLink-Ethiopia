const nodemailer = require("nodemailer");

/**
 * HomeLink email service — Nodemailer + Gmail SMTP (from homelink branch).
 * Port 587 (STARTTLS) primary — far more firewall/ISP friendly than 465.
 *
 * Supports both environment variable conventions:
 *   EMAIL_HOST_USER / GMAIL_USER
 *   EMAIL_HOST_PASSWORD / GMAIL_APP_PASSWORD
 *
 * If credentials are not set, it falls back to a development simulation,
 * logging the OTP code directly to the backend terminal so signups never fail.
 */

const user = process.env.EMAIL_HOST_USER || process.env.GMAIL_USER;
const pass = process.env.EMAIL_HOST_PASSWORD || process.env.GMAIL_APP_PASSWORD;
const SMTP_CONFIGURED = !!(user && pass);
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);

const transporter = SMTP_CONFIGURED
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // 465 = implicit TLS, 587 = STARTTLS
      auth: { user, pass },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    })
  : null;

if (SMTP_CONFIGURED && process.env.VERIFY_SMTP_ON_BOOT !== "false") {
  transporter.verify((error) => {
    if (error) {
      console.error("⚠️ SMTP verify failed (verification emails will fall back to console logging):", error.message);
    } else {
      console.log(`✉️  SMTP ready (port ${SMTP_PORT}) — verification emails will be delivered via Gmail (${user})`);
    }
  });
}

const sendVerificationEmail = async (email, code) => {
  try {
    if (!SMTP_CONFIGURED || !transporter) {
      console.warn(`⚠️ SMTP not configured — simulated verification email for ${email}. Code: [ ${code} ]`);
      return true;
    }

    const mailOptions = {
      from: `"HomeLink Ethiopia" <${user}>`,
      to: email,
      subject: "HomeLink Email Verification",
      html: `
        <div style="max-width:520px;margin:0 auto;font-family:Segoe UI,Arial,sans-serif;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
          <div style="background:#0f766e;color:#fff;padding:20px 28px">
            <h1 style="margin:0;font-size:20px">HomeLink Ethiopia</h1>
          </div>
          <div style="padding:28px">
            <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Welcome to HomeLink!</h2>
            <p style="margin:0 0 16px;color:#374151">Use this verification code to finish setting up your account:</p>
            <div style="font-size:34px;font-weight:700;letter-spacing:8px;color:#0f766e;background:#f0fdfa;border:1px dashed #0f766e;border-radius:8px;padding:14px 0;text-align:center">${code}</div>
            <p style="margin:16px 0 0;color:#6b7280;font-size:13px">This code expires in 10 minutes. If you did not create a HomeLink account, you can safely ignore this email.</p>
          </div>
          <div style="background:#f9fafb;padding:14px 28px;color:#9ca3af;font-size:12px">© HomeLink Ethiopia · Addis Ababa</div>
        </div>`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✉️ Verification email sent via Gmail:", info.messageId, "→", email);
    return true;
  } catch (error) {
    console.error("Email service error:", error.message);
    // Registration must not hard-fail on network/SMTP issues; log code to console
    console.warn(`⚠️ Email delivery failed, fallback code for ${email}: [ ${code} ]`);
    return true;
  }
};

module.exports = {
  sendVerificationEmail,
  SMTP_CONFIGURED,
};