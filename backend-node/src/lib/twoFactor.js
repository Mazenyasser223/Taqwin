const { generateSecret, generateURI, verifySync } = require('otplib');
const QRCode = require('qrcode');

function generateTwoFactorSecret() {
  return generateSecret();
}

function verifyTwoFactorToken(secret, token) {
  if (!secret || !token) return false;
  const result = verifySync({
    secret,
    token: String(token).replace(/\s/g, ''),
    epochTolerance: 30,
  });
  return Boolean(result?.valid);
}

function getOtpAuthUrl(email, secret) {
  return generateURI({ label: email, issuer: 'Taqwin', secret });
}

async function qrDataUrl(otpauthUrl) {
  return QRCode.toDataURL(otpauthUrl);
}

module.exports = {
  generateTwoFactorSecret,
  verifyTwoFactorToken,
  getOtpAuthUrl,
  qrDataUrl,
};
