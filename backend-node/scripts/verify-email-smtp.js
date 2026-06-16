#!/usr/bin/env node
/**
 * Verify Gmail SMTP (local or VPS).
 * Usage:
 *   node scripts/verify-email-smtp.js
 *   node scripts/verify-email-smtp.js --send test@example.com
 */
require('dotenv').config();

const {
  isEmailConfigured,
  verifySmtpConnection,
  sendVerificationEmail,
  generateVerificationCode,
} = require('../src/services/emailService');

async function main() {
  const sendTo = process.argv.includes('--send') ? process.argv[process.argv.indexOf('--send') + 1] : null;

  if (!isEmailConfigured()) {
    console.error('FAIL  GMAIL_USER / GMAIL_APP_PASSWORD not set in .env');
    process.exit(1);
  }

  console.log(`OK    configured sender: ${process.env.GMAIL_USER.trim()}`);

  try {
    await verifySmtpConnection();
    console.log('OK    SMTP connection (smtp.gmail.com:587)');
  } catch (err) {
    console.error('FAIL  SMTP verify:', err.message || err);
    process.exit(1);
  }

  if (sendTo) {
    const code = generateVerificationCode();
    try {
      await sendVerificationEmail(sendTo.trim().toLowerCase(), code, 'Test User');
      console.log(`OK    test verification email sent to ${sendTo}`);
      console.log(`      code (for manual check): ${code}`);
    } catch (err) {
      console.error('FAIL  send test email:', err.message || err);
      process.exit(1);
    }
  } else {
    console.log('Tip:  node scripts/verify-email-smtp.js --send your@email.com');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
