const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const sendVerificationEmail = async (email, code) => {
  try {
    const info = await transporter.sendMail({
      from: `"HomeLink Ethiopia" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "HomeLink Email Verification",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #059669; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">HomeLink Ethiopia</h1>
          </div>
          <div style="background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb;">
            <h2 style="color: #111827;">Welcome to HomeLink!</h2>
            <p style="color: #4b5563; font-size: 16px;">Your email verification code is:</p>
            <div style="background-color: white; border: 2px dashed #059669; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
              <h1 style="color: #059669; font-size: 36px; letter-spacing: 8px; margin: 0;">${code}</h1>
            </div>
            <p style="color: #6b7280; font-size: 14px;">This code will expire in <strong>10 minutes</strong>.</p>
            <p style="color: #6b7280; font-size: 14px;">If you did not create a HomeLink account, you can safely ignore this email.</p>
          </div>
          <div style="text-align: center; padding: 15px; color: #9ca3af; font-size: 12px;">
            <p>2026 HomeLink Ethiopia. All rights reserved.</p>
          </div>
        </div>
      `,
    });

    console.log("Verification email sent to:", email, "| Message ID:", info.messageId);
    return true;
  } catch (error) {
    console.error("Email sending error:", error.message);
    return false;
  }
};

module.exports = { sendVerificationEmail };
