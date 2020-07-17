const express = require("express");
const exphbs = require("express-handlebars");
const mailer = require("./services/mailer");
const config = require("./config");
const path = require("path");
const basicAuth = require("express-basic-auth");
const fetch = require("node-fetch");
const bodyParser = require("body-parser");
const minifyHTML = require("express-minify-html");
const compression = require("compression");

const removeMd = require("remove-markdown");
const showdown = require("showdown");
const convertMd = new showdown.Converter();

const app = express();
const helpers = require("./lib/helpers");
const data = require("./services/data");
const info = require("./services/info");
const { json } = require("express");
const { Converter } = require("showdown");

let gitData;

const hbs = exphbs.create({ helpers: helpers, extname: ".hbs" });

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
      minifyJS: true,
    },
  })
);
app.use(compression());
app.engine(".hbs", hbs.engine);
app.set("view engine", ".hbs");
app.use(bodyParser.urlencoded({ extended: true }));

app.use("/static", express.static(path.join(__dirname, "static")));

app.get("/", (req, res) => {
  res.render("landing", { title: "Collection" });
});

app.post("/", async (req, res) => {
  let email = req.body ? req.body.email : "";

  if (addrCheck(email)) {
    let record;

    record = await data.getRecByEmail(email);

    if (record.length > 0) {
      record[0]._rawJson.fields.id = record[0]._rawJson.id;
      res.render("collection", { title: "Continue", data: record[0]._rawJson.fields });
    } else {
      res.render("collection", { title: "Error", email: email });
    }
  } else {
    res.render("collection", { title: "Error", email: email });
  }
});

// Send statistics
app.get("/stat", async (req, res) => {
  gitData = gitData || await info.loadGitInfo()
  res.json(gitData)
})

app.post("/update/:id", async (req, res) => {
  await data.updateRecord(req.params.id, req.body);

  res.redirect("https://research.executebig.org/thanks.html");
});

// Protect full site with simple auth
const adminRouter = express.Router();
app.use("/admin", adminRouter);

adminRouter.use(basicAuth({ users: { [config.login.user]: config.login.password }, challenge: true }));

adminRouter.get("/", (req, res) => {
  submissions = data.loadSubmissions();
  let submissionsPromise = Promise.resolve(submissions);
  submissionsPromise.then((d) => {
    res.render("dashboard", { title: "Dashboard", layout: "admin", data: d, n: d.length });
  });
});

adminRouter.get("/email", (req, res) => {
  res.render("email", { title: "Auto Email", layout: "admin" });
});

adminRouter.post("/email", (req, res) => {
  // Accept variables
  let to = req.body.to.split(",").map((d) => d.trim());
  let from = req.body.from;
  let subject = req.body.subject.trim();
  let html = convertMd.makeHtml(req.body.content).replace(/(\r\n|\n|\r)/gm, "<br />");
  let plaintext = removeMd(req.body.content);

  console.log({
    to,
    from,
    subject,
    html,
    plaintext,
  });

  const checkResult = addrCheck(to);

  if (checkResult[0]) {
    mailer
      .send(from, to, subject, html, plaintext)
      .then((d) => {
        res.send("Success! + " + d);
      })
      .catch((err) => {
        res.send("Error! " + err);
      });
  } else {
    res.send(`Error! Invalid destination email ${checkResult[1]}`);
  }
});

adminRouter.get("/submission/:id", (req, res) => {
  submission = data.getDataById(req.params.id);
  let submissionPromise = Promise.resolve(submission);
  submissionPromise.then((d) => {
    console.log(d);
    res.render("submission", { title: `Submission #${d[0]["Autonumber"]}`, layout: "admin", data: d[0], noTabs: true });
  });
});
// console.log(mailer.send("hi@mingjie.dev", "This is a test message", "<h1>Test HTML content</h1><strong>Bold Content</strong>", "Test text content. Not bold content"))

app.listen(config.port, () => console.log(`Quest listening at ${config.host}`));

let addrCheck = (to) => {
  for (let i in to) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to[i])) return [false, to[i]];
  }

  return [true];
};
