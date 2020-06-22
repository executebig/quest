require("dotenv").config();

// Could use nconf, but a bit overkill
module.exports = {
  port: process.env.PORT || 3000,
  host: process.env.HOST || "http://localhost:3000",
  login: {
    user: process.env.LOGIN_USER,
    password: process.env.LOGIN_PASS
  },
  airtable: {
    key: process.env.AIRTABLE_KEY,
    base: process.env.AIRTABLE_BASE
  },
  mail: {
    api_key: process.env.SENDGRID_KEY,
    from: process.env.MAILER_FROM,
  },
};
