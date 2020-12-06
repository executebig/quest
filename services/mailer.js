const config = require('../config')
const sgMail = require('@sendgrid/mail')

sgMail.setApiKey(config.mail.api_key)

const templates = {
  onboard: 'd-00a94cfd71ed45b0baaca0d083d7372b'
}

const sender = 'team@executebig.org'

exports.sendAccessCode = (email, eventName, accessCode) => {
  if (config.noEmail) {
    console.log('Emailing skipped due to parameter...')
    return
  } else {
    const msg = {
      to: email,
      from: sender,
      templateId: templates['onboard'],
      dynamic_template_data: {
        eventName,
        accessCode
      }
    }

    sgMail.send(msg, (error, result) => {
      if (error) {
        console.log(error)
      } else {
        console.log("That's wassup!")
      }
    })
  }
}
