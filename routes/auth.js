const app = require('express').Router()
const passport = require('../services/passport')

app.get(
  '/',
  passport.authenticate('google', {
    hd: 'executebig.org',
    prompt: 'select_account',
    scope: ['profile', 'email'] // Used to specify the required data
  })
)

app.get('/callback', passport.authenticate('google'), (req, res) => {
  res.redirect('/admin')
})

app.get('/denied', (req, res) => {
  res.render('denied', { title: 'Access Denied' })
})

app.get('/logout', (req, res) => {
  req.logout()
  res.redirect('/')
})

module.exports = app
