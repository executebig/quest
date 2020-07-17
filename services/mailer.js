const config = require('../config')
const sgMail = require('@sendgrid/mail')

sgMail.setApiKey(config.mail.api_key)

exports.send = (from, to, subject, html, text) => {
  return new Promise((resolve, reject) => {
    sgMail.sendMultiple(
      {
        from: from,
        to: to,
        subject: subject,
        html: html,
        text: text
      },
      (err, info) => {
        if (err) {
          reject(err)
        } else {
          resolve(info)
        }
      }
    )
  })
}
