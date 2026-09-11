import nodemailer from "nodemailer";

/**
 * Checks whether SMTP credentials are fully provided in environment variables
 */
export const isEmailServiceConfigured = () => {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
};

/**
 * Creates Nodemailer SMTP transport or null if unconfigured
 */
const getTransporter = () => {
  if (!isEmailServiceConfigured()) {
    return null;
  }

  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

/**
 * Sends a 6-digit verification code to the student's college email.
 * Falls back to console simulation if SMTP is unconfigured or in test mode.
 *
 * @param {object} params
 * @param {string} params.email - Recipient NIT Kurukshetra email
 * @param {string} params.name - Recipient student name
 * @param {string} params.otp - 6-digit verification OTP
 * @returns {Promise<{ success: boolean, simulated?: boolean, messageId?: string }>}
 */
export const sendVerificationOTP = async ({ email, name = "Student", otp }) => {
  const fromAddress = process.env.EMAIL_FROM || "CampusX <no-reply@campusx.edu>";
  const firstName = name.split(" ")[0] || "Student";

  const textBody = `
Hello ${firstName},

Your CampusX verification code is:

${otp}

This code expires in 10 minutes.

Do not share this code with anyone. CampusX staff will never ask for your verification code.

Best regards,
The CampusX Team
  `.trim();

  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your CampusX student account</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #FAF7F2;
      color: #1F2937;
      margin: 0;
      padding: 30px 15px;
    }
    .container {
      max-width: 540px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #E5E7EB;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .header {
      background: #1B4D3E;
      color: #ffffff;
      padding: 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      letter-spacing: -0.5px;
    }
    .header p {
      margin: 6px 0 0 0;
      opacity: 0.9;
      font-size: 13px;
    }
    .content {
      padding: 32px 28px;
    }
    .greeting {
      font-size: 16px;
      margin-bottom: 16px;
    }
    .instructions {
      font-size: 14px;
      color: #4B5563;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .otp-card {
      background: #F8FAF9;
      border: 2px dashed #1B4D3E;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      margin: 24px 0;
    }
    .otp-code {
      font-family: 'Courier New', Courier, monospace;
      font-size: 34px;
      font-weight: 800;
      color: #1B4D3E;
      letter-spacing: 8px;
      margin: 0;
    }
    .otp-expiry {
      font-size: 12px;
      color: #6B7280;
      margin-top: 8px;
    }
    .warning {
      background: #FFFBEB;
      border-left: 4px solid #D97706;
      padding: 12px 16px;
      border-radius: 4px;
      font-size: 13px;
      color: #92400E;
      line-height: 1.5;
      margin-top: 20px;
    }
    .footer {
      background: #F9FAFB;
      border-top: 1px solid #E5E7EB;
      padding: 16px 28px;
      font-size: 12px;
      color: #9CA3AF;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CampusX</h1>
      <p>NIT Kurukshetra Student Marketplace</p>
    </div>
    <div class="content">
      <div class="greeting">Hello <strong>${firstName}</strong>,</div>
      <div class="instructions">
        Thank you for joining CampusX. To verify that you are a student at NIT Kurukshetra, please use the 6-digit verification code below:
      </div>
      <div class="otp-card">
        <div class="otp-code">${otp}</div>
        <div class="otp-expiry">This code expires in <strong>10 minutes</strong>.</div>
      </div>
      <div class="warning">
        <strong>Security Notice:</strong> Do not share this code with anyone. CampusX administrators will never ask for your verification code.
      </div>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} CampusX &middot; NIT Kurukshetra &middot; All rights reserved.
    </div>
  </div>
</body>
</html>
  `.trim();

  const isTest = process.env.NODE_ENV === "test";
  const transporter = getTransporter();

  // If SMTP is not configured or in test mode, safely log to console
  if (!transporter || isTest) {
    if (!isTest) {
      console.log(`\n======================================================`);
      console.log(`[CampusX Email Service] (Dev / Simulation Mode)`);
      console.log(`To: ${email}`);
      console.log(`Subject: Verify your CampusX student account`);
      console.log(`Your verification code is: ${otp}`);
      console.log(`Expires in: 10 minutes`);
      console.log(`======================================================\n`);
    }
    return { success: true, simulated: true };
  }

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: email,
      subject: "Verify your CampusX student account",
      text: textBody,
      html: htmlBody,
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[CampusX Email Service] Failed to deliver verification email:", error.message);
    throw error;
  }
};
