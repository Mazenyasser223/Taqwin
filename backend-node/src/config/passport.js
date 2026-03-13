/**
 * Taqwin — Passport Google OAuth configuration
 */
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { prisma } = require('../db');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/auth/google/callback',
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
          // User exists - update their Google ID and mark email as verified
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              googleId: profile.id,
              emailVerifiedAt: new Date(), // Mark as verified since Google verified it
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

        return done(null, user);
      } catch (error) {
        console.error('Google OAuth error:', error);
        return done(error, null);
      }
    }
  )
);

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
