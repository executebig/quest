require('dotenv').config()

// Could use nconf, but a bit overkill
module.exports = {
  port: process.env.PORT || 3000,
  host: process.env.HOST || 'http://localhost:3000',
  sessionKey: process.env.SESSION_KEY,
  encryptionKey: process.env.ENCRYPTION_KEY,
  oauth: {
    client: process.env.OAUTH_CLIENT,
    secret: process.env.OAUTH_SECRET
  },
  airtable: {
    key: process.env.AIRTABLE_KEY,
    base: process.env.AIRTABLE_BASE
  },
  mail: {
    api_key: process.env.SENDGRID_KEY
  },
  bugsnagKey: process.env.BUGSNAG_KEY,
  noEmail: process.env.NO_EMAIL || false
}
