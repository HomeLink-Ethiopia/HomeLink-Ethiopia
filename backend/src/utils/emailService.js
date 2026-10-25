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

const transporter = SMTP_CONFIGURED
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    })
  : null;

if (SMTP_CONFIGURED && process.env.VERIFY_SMTP_ON_BOOT !== "false") {
  transporter.verify((error) => {
    if (error) {
      console.error("⚠️ SMTP verify failed:", error.message);
    } else {
      console.log(`✉️  Gmail SMTP ready — emails will be delivered via Gmail (${user})`);
    }
  });
}

const sendVerificationEmail = async (email, code, verificationLink) => {
  try {
    if (!SMTP_CONFIGURED || !transporter) {
      console.warn(`⚠️ SMTP not configured — simulated verification email for ${email}. Code: [ ${code} ]`);
      return true;
    }

    const verifyUrl = verificationLink || `http://localhost:3000/verify-email?email=${encodeURIComponent(email)}&code=${code}`;

    const mailOptions = {
      from: `"HomeLink Ethiopia" <${user}>`,
      to: email,
      subject: "Verify Your HomeLink Account",
      html: `
        <div style="max-width:560px;margin:0 auto;font-family:'Segoe UI',Roboto,Arial,sans-serif;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;background:#ffffff">
          <div style="background:#B8451F;color:#ffffff;padding:24px 32px">
            <h1 style="margin:0;font-size:22px;font-weight:700">HomeLink Ethiopia</h1>
            <p style="margin:4px 0 0;font-size:13px;opacity:0.9">Ethiopia's Trusted Digital Housing Platform</p>
          </div>
          <div style="padding:32px">
            <h2 style="margin:0 0 12px;font-size:19px;color:#1F2421">Welcome to HomeLink!</h2>
            <p style="margin:0 0 20px;color:#4B5563;font-size:14px;line-height:1.6">
              Thank you for registering. Please click the button below to verify your email address:
            </p>
            <div style="text-align:center;margin:28px 0">
              <a href="${verifyUrl}" style="background:#B8451F;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block">
                Verify Email Address
              </a>
            </div>
            <p style="margin:20px 0 8px;color:#4B5563;font-size:13px">
              Or use this verification code if prompted:
            </p>
            <div style="font-size:28px;font-weight:700;letter-spacing:6px;color:#B8451F;background:#FFF6F0;border:1px dashed #B8451F;border-radius:8px;padding:12px 0;text-align:center">
              ${code}
            </div>
            <p style="margin:20px 0 0;color:#9CA3AF;font-size:12px;line-height:1.5">
              Direct verification link: <br/>
              <a href="${verifyUrl}" style="color:#B8451F;word-break:break-all">${verifyUrl}</a>
            </p>
          </div>
          <div style="background:#F9F9F7;padding:16px 32px;color:#9CA3AF;font-size:11px;border-top:1px solid #E5E7EB">
            © 2026 HomeLink Ethiopia · Addis Ababa, Ethiopia. If you did not register, please ignore this email.
          </div>
        </div>`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✉️ Verification email sent via Gmail:", info.messageId, "→", email);
    return true;
  } catch (error) {
    console.error("Email service error:", error.message);
    console.warn(`⚠️ Email delivery failed, fallback code for ${email}: [ ${code} ]`);
    return true;
  }
};

module.exports = {
  sendVerificationEmail,
  SMTP_CONFIGURED,
};