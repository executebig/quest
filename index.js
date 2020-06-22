const express = require("express");
const exphbs = require("express-handlebars");
const mailer = require("./services/mailer");
const config = require("./config");
const path = require("path");
const basicAuth = require("express-basic-auth");
const fetch = require("node-fetch");
const bodyParser = require("body-parser");

const removeMd = require("remove-markdown");
const showdown = require("showdown");
const convertMd = new showdown.Converter();

const app = express();
const helpers = require("./lib/helpers");
const data = require("./services/data");
const { json } = require("express");
const { Converter } = require("showdown");

const hbs = exphbs.create({ helpers: helpers, extname: ".hbs" });

// Protect full site with simple auth
app.use(basicAuth({ users: { [config.login.user]: config.login.password }, challenge: true }));
app.engine(".hbs", hbs.engine);
app.set("view engine", ".hbs");
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  submissions = data.loadSubmissions();
  let submissionsPromise = Promise.resolve(submissions);
  submissionsPromise.then((d) => {
    res.render("dashboard", { title: "Dashboard", data: d, n: d.length });
  });
});

app.get("/email", (req, res) => {
  res.render("email", { title: "Auto Email" });
});

app.post("/email", (req, res) => {
  // Accept variables
  let to = req.body.to.split(",").map(d => d.trim());
  let from = req.body.from;
  let subject = req.body.subject.trim();
  let html = convertMd.makeHtml(req.body.content).replace(/(\r\n|\n|\r)/gm,"<br />");
  let plaintext = removeMd(req.body.content);

  console.log({
    to, from, subject, html, plaintext
  })

  const checkResult = addrCheck(to);

  if (checkResult[0]) {
    mailer.send(from, to, subject, html, plaintext).then(d => {
      res.send("Success! + " + d)
    }).catch(err => {
      res.send("Error! " + err)
    })
  } else {
    res.send(`Error! Invalid destination email ${checkResult[1]}`)
  }

  
});

app.get("/submission/:id", (req, res) => {
  submission = data.getDataById(req.params.id);
  let submissionPromise = Promise.resolve(submission);
  submissionPromise.then((d) => {
    console.log(d);
    res.render("submission", { title: `Submission #${d[0]["Autonumber"]}`, data: d[0], noTabs: true });
  });
});

app.use("/static", express.static(path.join(__dirname, "static")));
// console.log(mailer.send("hi@mingjie.dev", "This is a test message", "<h1>Test HTML content</h1><strong>Bold Content</strong>", "Test text content. Not bold content"))

app.listen(config.port, () => console.log(`Quest listening at ${config.host}`));

let addrCheck = (to) => {
  for (let i in to) {
    if (! (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to[i]))) return [false, to[i]]
  }

  return [true]
}