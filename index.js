const express = require('express')
const exphbs = require('express-handlebars')
const mailer = require('./services/mailer')
const config = require('./config')
const path = require('path')
const fetch = require('node-fetch')
const bodyParser = require('body-parser')
const minifyHTML = require('express-minify-html')
const compression = require('compression')
const passport = require('passport')
const cors = require('cors')
const sassMiddleware = require('node-sass-middleware')
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy
const cookieSession = require('cookie-session')
const Bugsnag = require('@bugsnag/js')
const BugsnagPluginExpress = require('@bugsnag/plugin-express')

const removeMd = require('remove-markdown')
const showdown = require('showdown')
const convertMd = new showdown.Converter()

const app = express()
const helpers = require('./lib/helpers')
const data = require('./services/data')
const { json } = require('express')
const { Converter } = require('showdown')

const hbs = exphbs.create({ helpers: helpers, extname: '.hbs' })

Bugsnag.start({
  apiKey: config.bugsnagKey,
  plugins: [BugsnagPluginExpress]
})

const bugsnag = Bugsnag.getPlugin('express')

app.use(
  cookieSession({
    maxAge: 24 * 60 * 60 * 1000,
    keys: [config.sessionKey]
  })
)
app.use(bugsnag.requestHandler)
app.use(bugsnag.errorHandler)
app.use(passport.initialize())
app.use(passport.session()) // Persistent Sessions
app.use(cors())
app.use(
  minifyHTML({
    override: true,
    exception_url: false,
    htmlMinifier: {
      removeComments: true,
      collapseWhitespace: true,
      collapseBooleanAttributes: true,
      removeAttributeQuotes: true,
      removeEmptyAttributes: true,
      minifyJS: true
    }
  })
)
app.use(compression())
app.engine('.hbs', hbs.engine)
app.set('view engine', '.hbs')
app.use(bodyParser.urlencoded({ extended: true }))
app.use(
  sassMiddleware({
    src: path.join(__dirname, './styles'),
    dest: path.join(__dirname, './static/assets/css'),
    outputStyle: 'compressed',
    prefix: '/static/assets/css/'
  })
)

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

// Middleware to check if the user is authenticated
const isUserAuthenticated = (req, res, next) => {
  if (req.user) {
    if (req.user._json.hd == 'executebig.org') {
      req.userData = {
        name: req.user._json.name,
        email: req.user._json.email,
        picture: req.user._json.picture
      }
      next()
    } else {
      res.redirect('/denied')
    }
  } else {
    res.redirect('/auth')
  }
}

app.get('/api/public', async (req, res) => {
  const d = await data.loadPublicData()

  res.json(d)
})

app.use('/static', express.static(path.join(__dirname, 'static')))

app.get('/', (req, res) => {
  res.render('landing', { title: 'Welcome' })
})

app.get('/onboard', (req, res) => {
  res.render('onboard', {
    title: 'Onboarding',
    layout: 'custom',
    eventName: req.query.eventName,
    email: req.query.email
  })
})

// app.post('/', async (req, res) => {
//   let email = req.body ? req.body.email : ''

//   if (addrCheck(email)) {
//     let record

//     record = await data.getRecByEmail(email)

//     if (record.length > 0) {
//       record[0]._rawJson.fields.id = record[0]._rawJson.id
//       res.render('collection', {
//         title: 'Continue',
//         data: record[0]._rawJson.fields
//       })
//     } else {
//       res.render('collection', { title: 'Error', email: email })
//     }
//   } else {
//     res.render('collection', { title: 'Error', email: email })
//   }
// })

app.get(
  '/auth',
  passport.authenticate('google', {
    hd: 'executebig.org',
    prompt: 'select_account',
    scope: ['profile', 'email'] // Used to specify the required data
  })
)

app.get('/auth/callback', passport.authenticate('google'), (req, res) => {
  res.redirect('/admin')
})

app.get('/denied', (req, res) => {
  res.render('denied', { title: 'Access Denied' })
})

app.get('/auth/logout', (req, res) => {
  req.logout()
  res.redirect('/')
})

app.post('/update/:id', async (req, res) => {
  await data.updateRecord(req.params.id, req.body)

  res.redirect('https://research.executebig.org/thanks.html')
})

// Protect full site with simple auth
const adminRouter = express.Router()
app.use('/admin', adminRouter)

adminRouter.use(isUserAuthenticated)

adminRouter.get('/', (req, res) => {
  submissions = data.loadSubmissions()
  let submissionsPromise = Promise.resolve(submissions)
  submissionsPromise.then((d) => {
    res.render('dashboard', {
      title: 'Research Dashboard',
      layout: 'admin',
      data: d,
      n: d.length,
      userData: req.userData
    })
  })
})

adminRouter.get('/email', (req, res) => {
  res.render('email', {
    title: 'Auto Email',
    layout: 'admin',
    userData: req.userData
  })
})

adminRouter.post('/email', (req, res) => {
  // Accept variables
  let to = req.body.to.split(',').map((d) => d.trim())
  let from = req.body.from
  let subject = req.body.subject.trim()
  let html = convertMd
    .makeHtml(req.body.content)
    .replace(/(\r\n|\n|\r)/gm, '<br />')
  let plaintext = removeMd(req.body.content)

  console.log({
    to,
    from,
    subject,
    html,
    plaintext
  })

  if (addrCheck(to)) {
    mailer
      .send(from, to, subject, html, plaintext)
      .then((d) => {
        res.send('Success! + ' + d)
      })
      .catch((err) => {
        res.send('Error! ' + err)
      })
  } else {
    res.send(`Error! Invalid destination email ${checkResult[1]}`)
  }
})

adminRouter.get('/submission/:id', (req, res) => {
  submission = data.getDataById(req.params.id)
  let submissionPromise = Promise.resolve(submission)
  submissionPromise.then((d) => {
    console.log(d)
    res.render('submission', {
      title: `Submission #${d[0]['Autonumber']}`,
      layout: 'admin',
      data: d[0],
      noTabs: true,
      userData: req.userData
    })
  })
})

adminRouter.post('/update/:id', async (req, res) => {
  await data.updateStats(req.params.id, req.body)

  res.redirect('/admin')
})

app.listen(config.port, () => console.log(`Quest listening at ${config.host}`))

let addrCheck = (addr) => {
  const rule = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

  return rule.test(String(addr).toLowerCase())
}
