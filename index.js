const express = require('express')
const exphbs = require('express-handlebars')
const mailer = require('./services/mailer')
const config = require('./config')
const path = require('path')
const url = require('url')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const minifyHTML = require('express-minify-html')
const compression = require('compression')
const cors = require('cors')
const sassMiddleware = require('node-sass-middleware')
const expressSession = require('express-session')
const csrf = require('csurf')
const passport = require('./services/passport')

const crypt = require('crypto-js')

const app = express()
const helpers = require('./lib/helpers')
const data = require('./services/data')

const hbs = exphbs.create({ helpers: helpers, extname: '.hbs' })

const csrfProtection = csrf({ cookie: true })

app.use(bodyParser.json())
app.use(cookieParser())
app.use(
  expressSession({
    secret: config.sessionKey,
    resave: false,
    saveUninitialized: false,
    cookie: {
      expires: false
    }
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
      res.redirect('/auth/denied')
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
    const accessCode = encodeURIComponent(
      crypt.Rabbit.encrypt(id, config.encryptionKey).toString()
    )

    console.log(accessCode)
    mailer.sendAccessCode(req.body.email, req.body.eventName, accessCode)

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
    const access = decodeURIComponent(req.query.access)

    const recordId = crypt.Rabbit.decrypt(
      access,
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
  const access = decodeURIComponent(req.query.access)
  const recordId = crypt.Rabbit.decrypt(access, config.encryptionKey).toString(
    crypt.enc.Utf8
  )

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

app.use('/auth', require('./routes/auth'))
app.use('/admin', isUserAuthenticated, require('./routes/admin'))

app.listen(config.port, () => console.log(`Quest listening at ${config.host}`))

let addrCheck = (addr) => {
  const rule = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

  return rule.test(String(addr).toLowerCase())
}
