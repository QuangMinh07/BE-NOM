const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const User = require('./models/user');

// Cấu hình Google Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/auth/google/callback"
},
async (accessToken, refreshToken, profile, done) => {
  try {
    const existingUser = await User.findOne({ googleId: profile.id });

    if (existingUser) {
      return done(null, existingUser);
    }

    const newUser = new User({
      googleId: profile.id,
      userName: profile.emails[0].value.split('@')[0], // Sử dụng phần trước @ của email làm userName
      email: profile.emails[0].value,
      isVerified: true,
    });

    await newUser.save();
    done(null, newUser);
  } catch (error) {
    done(error, false);
  }
}));

// Cấu hình Facebook Strategy
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_CLIENT_ID,
  clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
  callbackURL: "/auth/facebook/callback",
  profileFields: ['id', 'emails', 'name'] // Yêu cầu profile và email
},
async (accessToken, refreshToken, profile, done) => {
  try {
    const existingUser = await User.findOne({ facebookId: profile.id });

    if (existingUser) {
      return done(null, existingUser);
    }

    const newUser = new User({
      facebookId: profile.id,
      userName: `${profile.name.givenName} ${profile.name.familyName}`, // Ghép tên và họ thành userName
      email: profile.emails ? profile.emails[0].value : `${profile.id}@facebook.com`, // Nếu không có email, tạo email giả
      isVerified: true,
    });

    await newUser.save();
    done(null, newUser);
  } catch (error) {
    done(error, false);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});
