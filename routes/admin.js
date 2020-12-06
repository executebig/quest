// Protect full site with simple auth
const app = require('express').Router()
const data = require('../services/data')

app.get('/', (req, res) => {
  submissions = data.loadSubmissions()
  let submissionsPromise = Promise.resolve(submissions)
  submissionsPromise.then((d) => {
    res.render('admin/dashboard', {
      title: 'Research Dashboard',
      layout: 'admin',
      data: d,
      n: d.length,
      userData: req.userData
    })
  })
})

app.get('/submission/:id', (req, res) => {
  submission = data.getDataById(req.params.id)
  let submissionPromise = Promise.resolve(submission)
  submissionPromise.then((d) => {
    console.log(d)
    res.render('admin/submission', {
      title: `Submission #${d[0]['Autonumber']}`,
      layout: 'admin',
      data: d[0],
      noTabs: true,
      userData: req.userData
    })
  })
})

app.post('/update/:id', async (req, res) => {
  await data.updateStats(req.params.id, req.body)

  res.redirect('/admin')
})

module.exports = app
