const express = require('express')
const exphbs = require('express-handlebars')
const mailer = require('./services/mailer')
const config = require('./config')
const path = require('path')
const url = require('url')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const session = require('express-session')
const minifyHTML = require('express-minify-html')
const compression = require('compression')
const passport = require('passport')
const cors = require('cors')
const sassMiddleware = require('node-sass-middleware')
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy
const cookieSession = require('cookie-session')
const csrf = require('csurf')

const crypt = require('crypto-js')

const removeMd = require('remove-markdown')
const showdown = require('showdown')
const convertMd = new showdown.Converter()

const app = express()
const helpers = require('./lib/helpers')
const data = require('./services/data')

const hbs = exphbs.create({ helpers: helpers, extname: '.hbs' })

const csrfProtection = csrf({ cookie: true })

app.use(cookieParser())
app.use(
  cookieSession({
    maxAge: 24 * 60 * 60 * 1000,
    keys: [config.sessionKey]
  })
)
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

// route reserved for static site generation of our website
app.get('/api/public', async (req, res) => {
  const d = await data.loadPublicData()

  res.json(d)
})

app.use('/static', express.static(path.join(__dirname, 'static')))

app.get('/', csrfProtection, (req, res) => {
  res.render('landing', {
    title: 'Welcome',
    nonav: true,
    csrfToken: req.csrfToken()
  })
})

// service route -- does not render anything
app.post('/onboard', csrfProtection, (req, res) => {
  data.onboard(req.body.eventName, req.body.email).then((id) => {
    const accessCode = crypt.Rabbit.encrypt(id, config.encryptionKey).toString()

    console.log(accessCode)

    res.redirect(
      url.format({
        pathname: '/onboard',
        query: {
          access: accessCode
        }
      })
    )
  })
})

// separate page to prevent form resubmission
app.get('/onboard', (req, res) => {
  if (req.query.access) {
    const recordId = crypt.Rabbit.decrypt(
      req.query.access,
      config.encryptionKey
    ).toString(crypt.enc.Utf8)

    data
      .getDataById(recordId)
      .then((data) => {
        if (data.length == 1) {
          res.render('onboard', {
            title: 'Onboarding',
            layout: 'custom',
            eventName: data[0]['Event Name'],
            email: data[0]['Contact Email'],
            id: recordId,
            accessCode: req.query.access,
            returnLink: url.format({
              pathname: config.host + '/onboard',
              query: {
                access: req.query.access
              }
            })
          })
        } else {
          res.status(404).render('404')
        }
      })
      .catch((err) => {
        res.status(404).render('404')
      })
  } else {
    res.status(404).render('404')
  }
})

app.get('/next', async (req, res) => {
  const recordId = crypt.Rabbit.decrypt(
    req.query.access,
    config.encryptionKey
  ).toString(crypt.enc.Utf8)

  data.getDataById(recordId).then((data) => {
    console.log(data)
    res.render('next', {
      title: 'Continue',
      layout: 'custom',
      ...data[0]
    })
  })
})

app.get('/schedule', (req, res) => {
  res.render('schedule', {
    title: 'Schedule Meeting',
    layout: 'custom',
    name: req.query.name,
    email: req.query.email
  })
})

app.get('/scheduled', (req, res) => {
  res.render('scheduled', { title: 'Meeting Scheduled', layout: 'custom' })
})

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
