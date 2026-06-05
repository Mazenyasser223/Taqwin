/**
 * Google OAuth credentials — sanitize Render/env paste mistakes before Passport uses them.
 */
const { firstEnvLine } = require('./googleCallbackUrl');
const { resolveGoogleCallbackUrl } = require('./googleCallbackUrl');

const CLIENT_ID_RE = /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/i;
const PLACEHOLDER_CLIENT_IDS = new Set([
  'your-google-client-id.apps.googleusercontent.com',
  'local-dev-disabled',
]);

function getGoogleOAuthCredentials() {
  const clientID = firstEnvLine('GOOGLE_CLIENT_ID').replace(/\s/g, '');
  const clientSecret = firstEnvLine('GOOGLE_CLIENT_SECRET').replace(/\s/g, '');
  return { clientID, clientSecret };
}

function validateGoogleOAuthConfig() {
  const { clientID, clientSecret } = getGoogleOAuthCredentials();
  const issues = [];

  if (!clientID) {
    issues.push('GOOGLE_CLIENT_ID is missing');
  } else if (PLACEHOLDER_CLIENT_IDS.has(clientID)) {
    issues.push('GOOGLE_CLIENT_ID is still a placeholder');
  } else if (!CLIENT_ID_RE.test(clientID)) {
    issues.push(
      `GOOGLE_CLIENT_ID is malformed (expected 123456789-xxxx.apps.googleusercontent.com). Check for typos such as googleuserconeent.com or missing hyphens.`,
    );
  }

  if (!clientSecret) {
    issues.push('GOOGLE_CLIENT_SECRET is missing');
  } else if (!clientSecret.startsWith('GOCSPX-') && clientSecret.length < 16) {
    issues.push('GOOGLE_CLIENT_SECRET looks too short or invalid');
  }

  return { ok: issues.length === 0, issues, clientID, clientSecret };
}

function isGoogleOAuthEnabled() {
  return validateGoogleOAuthConfig().ok;
}

function getGoogleOAuthDiagnostics() {
  const validation = validateGoogleOAuthConfig();
  const { clientID } = validation;
  return {
    configured: Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()),
    valid: validation.ok,
    issues: validation.issues,
    clientIdSuffix: clientID ? clientID.slice(-30) : null,
    callbackUrl: resolveGoogleCallbackUrl(),
  };
}

function logGoogleOAuthConfigIssues() {
  const { ok, issues } = validateGoogleOAuthConfig();
  if (ok) return;
  console.error('[auth] Google OAuth misconfigured:', issues.join(' | '));
}

module.exports = {
  getGoogleOAuthCredentials,
  validateGoogleOAuthConfig,
  isGoogleOAuthEnabled,
  getGoogleOAuthDiagnostics,
  logGoogleOAuthConfigIssues,
};
