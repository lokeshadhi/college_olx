/**
 * CampusX Email Service
 * Uses Brevo HTTPS API instead of SMTP.
 */

export const isEmailServiceConfigured = () => {
  return Boolean(
    process.env.BREVO_API_KEY &&
    process.env.EMAIL_FROM
  );
};

/**
 * Shared Brevo HTTPS API email delivery helper.
 */
const sendBrevoEmail = async ({
  toEmail,
  toName = "Student",
  subject,
  htmlContent,
  textContent,
}) => {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;
  const fromName = process.env.EMAIL_FROM_NAME || "CampusX";

  if (!apiKey || !fromEmail) {
    throw new Error(
      "Brevo email service is not configured. Missing BREVO_API_KEY or EMAIL_FROM."
    );
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        name: fromName,
        email: fromEmail,
      },
      to: [
        {
          email: toEmail,
          name: toName,
        },
      ],
      subject,
      htmlContent,
      textContent,
    }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    console.error(
      "[CampusX Email Service] Brevo API error:",
      response.status,
      responseText
    );
    throw new Error(
      `Brevo email failed (${response.status}): ${responseText}`
    );
  }

  let result = {};
  try {
    result = JSON.parse(responseText);
  } catch {
    // Brevo may return an empty/non-JSON response.
  }

  console.log(
    `[CampusX Email Service] Email "${subject}" sent successfully to ${toEmail}:`,
    result.messageId || "accepted"
  );

  return {
    success: true,
    messageId: result.messageId,
  };
};

/**
 * Sends a 6-digit verification code to the student's college email.
 *
 * @param {object} params
 * @param {string} params.email - Recipient NIT Kurukshetra email
 * @param {string} params.name - Recipient student name
 * @param {string} params.otp - 6-digit verification OTP
 */
export const sendVerificationOTP = async ({
  email,
  name = "Student",
  otp,
}) => {
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
      font-family: Arial, sans-serif;
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
    }

    .header p {
      margin: 6px 0 0;
      font-size: 13px;
    }

    .content {
      padding: 32px 28px;
    }

    .instructions {
      font-size: 14px;
      color: #4B5563;
      line-height: 1.6;
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
      font-family: monospace;
      font-size: 34px;
      font-weight: 800;
      color: #1B4D3E;
      letter-spacing: 8px;
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

      <p>
        Hello <strong>${firstName}</strong>,
      </p>

      <div class="instructions">
        Thank you for joining CampusX.
        To verify that you are a student at NIT Kurukshetra,
        please use the 6-digit verification code below.
      </div>

      <div class="otp-card">
        <div class="otp-code">${otp}</div>

        <div class="otp-expiry">
          This code expires in <strong>10 minutes</strong>.
        </div>
      </div>

      <div class="warning">
        <strong>Security Notice:</strong>
        Do not share this code with anyone.
        CampusX administrators will never ask for your verification code.
      </div>

    </div>

    <div class="footer">
      &copy; ${new Date().getFullYear()}
      CampusX · NIT Kurukshetra · All rights reserved.
    </div>

  </div>

</body>
</html>
  `.trim();

  return sendBrevoEmail({
    toEmail: email,
    toName: firstName,
    subject: "Verify your CampusX student account",
    htmlContent: htmlBody,
    textContent: textBody,
  });
};

/**
 * Sends a 6-digit password reset code to the student's college email.
 *
 * @param {object} params
 * @param {string} params.email - Recipient NIT Kurukshetra email
 * @param {string} params.name - Recipient student name
 * @param {string} params.otp - 6-digit password reset OTP
 */
export const sendPasswordResetOTP = async ({
  email,
  name = "Student",
  otp,
}) => {
  const firstName = name.split(" ")[0] || "Student";

  const textBody = `
Hello ${firstName},

We received a request to reset your CampusX password.

Your CampusX password reset code is:

${otp}

This code expires in 10 minutes.

Do not share this code with anyone. CampusX staff will never ask for your password reset code.
If you did not request a password reset, you can safely ignore this email.

Best regards,
The CampusX Team
  `.trim();

  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your CampusX password</title>

  <style>
    body {
      font-family: Arial, sans-serif;
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
    }

    .header p {
      margin: 6px 0 0;
      font-size: 13px;
    }

    .content {
      padding: 32px 28px;
    }

    .instructions {
      font-size: 14px;
      color: #4B5563;
      line-height: 1.6;
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
      font-family: monospace;
      font-size: 34px;
      font-weight: 800;
      color: #1B4D3E;
      letter-spacing: 8px;
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

      <p>
        Hello <strong>${firstName}</strong>,
      </p>

      <div class="instructions">
        We received a request to reset your CampusX password.
        Please use the 6-digit verification code below to authorize your password reset.
      </div>

      <div class="otp-card">
        <div class="otp-code">${otp}</div>

        <div class="otp-expiry">
          This code expires in <strong>10 minutes</strong>.
        </div>
      </div>

      <div class="warning">
        <strong>Security Notice:</strong>
        Do not share this code with anyone.
        CampusX administrators will never ask for your password reset code.
        If you did not request this password reset, your account remains secure and you can safely ignore this email.
      </div>

    </div>

    <div class="footer">
      &copy; ${new Date().getFullYear()}
      CampusX · NIT Kurukshetra · All rights reserved.
    </div>

  </div>

</body>
</html>
  `.trim();

  return sendBrevoEmail({
    toEmail: email,
    toName: firstName,
    subject: "CampusX Password Reset OTP",
    htmlContent: htmlBody,
    textContent: textBody,
  });
};