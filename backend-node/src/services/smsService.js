/**
 * Twilio Verify — SMS OTP for password reset and phone verification.
 */
const { normalizePhoneE164 } = require('../lib/phoneNormalize');

function isTwilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_VERIFY_SERVICE_SID?.trim(),
  );
}

function getClient() {
  if (!isTwilioConfigured()) {
    throw new Error('Twilio is not configured (TWILIO_ACCOUNT_SID / AUTH_TOKEN / VERIFY_SERVICE_SID)');
  }
  const twilio = require('twilio');
  return twilio(process.env.TWILIO_ACCOUNT_SID.trim(), process.env.TWILIO_AUTH_TOKEN.trim());
}

function getVerifyServiceSid() {
  return process.env.TWILIO_VERIFY_SERVICE_SID.trim();
}

/**
 * Send OTP via SMS to an E.164 number.
 */
async function sendVerificationSms(phoneE164) {
  const to = normalizePhoneE164(phoneE164) || phoneE164;
  if (!to?.startsWith('+')) {
    throw new Error('Invalid phone number format');
  }
  const client = getClient();
  const verification = await client.verify.v2
    .services(getVerifyServiceSid())
    .verifications.create({ to, channel: 'sms' });
  return { sid: verification.sid, status: verification.status, to };
}

/**
 * Check OTP entered by the user.
 */
async function checkVerificationSms(phoneE164, code) {
  const to = normalizePhoneE164(phoneE164) || phoneE164;
  if (!to?.startsWith('+')) {
    throw new Error('Invalid phone number format');
  }
  const client = getClient();
  const check = await client.verify.v2
    .services(getVerifyServiceSid())
    .verificationChecks.create({ to, code: String(code).trim() });
  return check.status === 'approved';
}

/**
 * Map Twilio REST errors to a short message for the client.
 */
function getTwilioUserMessage(err) {
  const code = err?.code;
  if (code === 21608) {
    return (
      'Twilio trial: this phone number is not verified. Open Twilio Console → Phone Numbers → ' +
      'Verified Caller IDs, add the number in E.164 format (e.g. +201205649670), complete verification, then try again.'
    );
  }
  if (code === 60202 || code === 60203) {
    return 'Too many verification attempts. Wait a few minutes and try again.';
  }
  if (code === 20429 || code === 20003) {
    return 'Twilio credentials are invalid. Check TWILIO_* in backend-node/.env.';
  }
  return 'Failed to send SMS. Verify the number in Twilio Console (trial) or try again.';
}

module.exports = {
  isTwilioConfigured,
  sendVerificationSms,
  checkVerificationSms,
  normalizePhoneE164,
  getTwilioUserMessage,
};
