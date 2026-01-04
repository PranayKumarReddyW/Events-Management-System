const nodemailer = require("nodemailer");
const logger = require("./logger");

// Create transporter
const createTransporter = () => {
  if (process.env.EMAIL_SERVICE === "sendgrid") {
    return nodemailer.createTransport({
      service: "SendGrid",
      auth: {
        user: "apikey",
        pass: process.env.SENDGRID_API_KEY,
      },
    });
  }

  // SMTP configuration
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_PORT == 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const transporter = createTransporter();

// Send email
exports.sendEmail = async ({ to, subject, html, text, template, data }) => {
  try {
    // If template is provided, use it (you can add template engine later)
    const emailHtml = html || generateEmailFromTemplate(template, data);
    const emailText = text || extractTextFromHtml(emailHtml);

    const mailOptions = {
      from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
      to,
      subject,
      html: emailHtml,
      text: emailText,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${to}: ${info.messageId}`);

    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error("Email send failed:", error);
    throw error;
  }
};

// Send bulk emails
exports.sendBulkEmails = async (emails) => {
  const results = [];

  for (const email of emails) {
    try {
      const result = await exports.sendEmail(email);
      results.push({ email: email.to, success: true, result });
    } catch (error) {
      results.push({ email: email.to, success: false, error: error.message });
    }
  }

  return results;
};

// Email templates
const generateEmailFromTemplate = (template, data) => {
  const templates = {
    welcome: `
      <h1>Welcome to Event Management System!</h1>
      <p>Hi ${data.name},</p>
      <p>Thank you for registering with us. We're excited to have you on board!</p>
      <p>Start exploring events and register for the ones you're interested in.</p>
      <a href="${process.env.FRONTEND_URL}/events">Browse Events</a>
    `,
    "reset-password": `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333; text-align: center;">Password Reset Request</h1>
        <p style="color: #666; line-height: 1.6;">Hi ${data.name},</p>
        <p style="color: #666; line-height: 1.6;">You requested to reset your password. Click the button below to proceed:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.resetUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Reset Password</a>
        </div>
        <p style="color: #666; line-height: 1.6;">Or copy and paste this link in your browser:</p>
        <p style="color: #007bff; word-break: break-all; background-color: #f5f5f5; padding: 10px; border-radius: 3px;">${data.resetUrl}</p>
        <p style="color: #999; font-size: 12px; margin-top: 20px;">This link will expire in 1 hour.</p>
        <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email and do not share this link with anyone.</p>
      </div>
    `,
    "registration-confirmation": `
      <h1>Event Registration Confirmed!</h1>
      <p>Hi ${data.name},</p>
      <p>Your registration for <strong>${data.eventName}</strong> has been confirmed!</p>
      <p><strong>Event Details:</strong></p>
      <ul>
        <li>Date: ${data.date}</li>
        <li>Time: ${data.time}</li>
        <li>Venue: ${data.venue}</li>
      </ul>
      <p>We look forward to seeing you there!</p>
    `,
    "certificate-ready": `
      <h1>Your Certificate is Ready!</h1>
      <p>Hi ${data.name},</p>
      <p>Your certificate for <strong>${data.eventName}</strong> is now available!</p>
      <p><a href="${data.certificateUrl}">Download Certificate</a></p>
      <p>Verification Code: ${data.verificationCode}</p>
    `,
  };

  return templates[template] || "";
};

const extractTextFromHtml = (html) => {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

// Verify transporter configuration
transporter.verify((error, success) => {
  if (error) {
    logger.error("Email transporter configuration error:", error);
  } else {
    logger.info("Email transporter is ready to send emails");
  }
});

module.exports = exports;
