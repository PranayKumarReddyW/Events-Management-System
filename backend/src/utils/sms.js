const twilio = require("twilio");
const logger = require("./logger");

let twilioClient;

const getTwilioClient = () => {
  if (twilioClient) return twilioClient;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials are not configured");
  }

  // Twilio Account SIDs start with 'AC'. If this is wrong, twilio() can throw.
  if (!accountSid.startsWith("AC")) {
    throw new Error("Invalid Twilio account SID (must start with 'AC')");
  }

  twilioClient = twilio(accountSid, authToken);
  return twilioClient;
};

// Send SMS
exports.sendSMS = async ({ to, message }) => {
  try {
    if (process.env.ENABLE_SMS_NOTIFICATIONS !== "true") {
      logger.info("SMS notifications disabled");
      return { success: true, message: "SMS notifications disabled" };
    }

    if (!process.env.TWILIO_PHONE_NUMBER) {
      throw new Error("Twilio phone number is not configured");
    }

    // Ensure phone number has country code
    const phoneNumber = to.startsWith("+") ? to : `+91${to}`;

    const client = getTwilioClient();

    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });

    logger.info(`SMS sent to ${phoneNumber}: ${result.sid}`);

    return {
      success: true,
      sid: result.sid,
      status: result.status,
    };
  } catch (error) {
    logger.error("SMS send failed:", error);
    throw error;
  }
};

// Send bulk SMS
exports.sendBulkSMS = async (messages) => {
  const results = [];

  for (const msg of messages) {
    try {
      const result = await exports.sendSMS(msg);
      results.push({ phone: msg.to, success: true, result });
    } catch (error) {
      results.push({ phone: msg.to, success: false, error: error.message });
    }
  }

  return results;
};

// Send OTP
exports.sendOTP = async (phone, otp) => {
  const message = `Your OTP for Event Management System is: ${otp}. Valid for 10 minutes.`;
  return await exports.sendSMS({ to: phone, message });
};

// SMS templates
exports.sendTemplatedSMS = async (phone, template, data) => {
  const templates = {
    "registration-confirmation": `Hi ${data.name}, your registration for ${data.eventName} is confirmed! Event on ${data.date}. Check your email for details.`,
    "event-reminder": `Reminder: ${data.eventName} starts in ${data.hours} hours at ${data.venue}. See you there!`,
    "certificate-ready": `Hi ${data.name}, your certificate for ${data.eventName} is ready! Download it from your dashboard.`,
    "payment-success": `Payment of ₹${data.amount} received successfully for ${data.eventName}. Registration confirmed!`,
  };

  const message = templates[template];

  if (!message) {
    throw new Error("Invalid SMS template");
  }

  return await exports.sendSMS({ to: phone, message });
};

module.exports = exports;
