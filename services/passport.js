const config = require('../config')

const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy

// Strategy config
passport.use(
  new GoogleStrategy(
    {
      clientID: config.oauth.client,
      clientSecret: config.oauth.secret,
      callbackURL: config.host + '/auth/callback'
    },
    (accessToken, refreshToken, profile, done) => {
      done(null, profile) // passes the profile data to serializeUser
    }
  )
)

// Used to stuff a piece of information into a cookie
passport.serializeUser((user, done) => {
  done(null, user)
})

// Used to decode the received cookie and persist session
passport.deserializeUser((user, done) => {
  done(null, user)
})

module.exports = passport
