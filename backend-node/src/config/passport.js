/**
 * Taqwin — Passport Google OAuth configuration
 */
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { prisma } = require('../db');
const { resolveGoogleCallbackUrl } = require('../lib/googleCallbackUrl');
const {
  getGoogleOAuthCredentials,
  isGoogleOAuthEnabled,
  logGoogleOAuthConfigIssues,
} = require('../lib/googleOAuthConfig');

logGoogleOAuthConfigIssues();

if (isGoogleOAuthEnabled()) {
  const { clientID, clientSecret } = getGoogleOAuthCredentials();
  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL: resolveGoogleCallbackUrl(),
      },
      async (accessToken, refreshToken, profile, done) => {
      try {
        // Extract email from Google profile
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('No email found in Google profile'), null);
        }

        const emailLower = email.toLowerCase();

        // Check if user already exists
        let user = await prisma.user.findUnique({
          where: { email: emailLower },
        });

        if (user) {
          // Existing account with password — signup must not link or sign in via Google
          if (user.passwordHash) {
            return done(null, user);
          }
          // Resume incomplete Google sign-up (no password yet)
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              googleId: profile.id,
              emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
            },
          });
          return done(null, user);
        }

        // Create new user with Google OAuth
        user = await prisma.user.create({
          data: {
            email: emailLower,
            passwordHash: null, // OAuth users don't have passwords
            role: 'athlete', // Default role, can be changed later
            googleId: profile.id,
            emailVerifiedAt: new Date(), // Google has already verified the email
          },
        });

        // Create profile for the user
        await prisma.profile.create({
          data: {
            userId: user.id,
            displayName: profile.displayName || profile.name?.givenName || email.split('@')[0],
            avatarUrl: profile.photos?.[0]?.value || null,
          },
        });
        await prisma.userSettings.create({
          data: { userId: user.id },
        });

        return done(null, user);
      } catch (error) {
        console.error('Google OAuth error:', error);
        return done(error, null);
      }
      }
    )
  );
}

// Serialize user to session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
