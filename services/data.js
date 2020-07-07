/**
 * Data Sockets
 */

const config = require("../config");
const airtable = require("airtable");

const base = new airtable({ apiKey: config.airtable.key }).base(config.airtable.base);

// Promise to convert Airtable data into json stream
const loadSubmissions = async () => {
  const recList = [];
  await base("Submissions")
    .select({
      view: "Grid view",
    })
    .all()
    .then((records) => {
      for (let i = 0; i < records.length; i++) {
        records[i]._rawJson.fields.id = records[i]._rawJson.id;
        recList.push(records[i]._rawJson.fields);
      }
    })
    .catch(function () {
      console.log("Promise Rejected");
    });

  return recList;
};

const getDataById = async (rid) => {
  const data = [];

  await base("Submissions")
    .find(rid).then((record) => {
      record._rawJson.fields.id = record._rawJson.id;
      data.push(record._rawJson.fields);
    })
    .catch(function () {
      console.log("Promise Rejected");
    });

  return data;
};

const getRecByEmail = async (email) => {
  return new Promise((resolve, reject) => {
    let results = base("Submissions").select({
      view: "Incomplete",
      filterByFormula: `{Contact Email} = "${email}"`
    }).all()

    resolve(results)
  })
}

const updateRecord = async (rid, d) => {

  return new Promise((resolve, reject) => {
    base('Submissions').update(rid, {
      "Complete": true,
      "Website": d.website,
      "Scope": d.scope,
      "Demographic Restrictions": d.demRes,
      "Finaid": d.finaid,
      "Application Tags": d.application,
      "Budget": d.budget,
      "Marketing": d.marketing,
      "Mentors": d.mentors === "TRUE",
      "Workshops": d.workshops === "TRUE",
      "Lead Profiles": d.displayLead === "TRUE",
      "Leadership": d.leadership,
      "Attrition": 1 - Number(d.attendance) / 100,
      "Projects Submitted": d.projects
    }, {typecast:true}, function(err, record) {
      if (err) {
        reject(err)
        console.log(err)
      }
      
      resolve()
    })
  })
}

module.exports = { loadSubmissions, getDataById, getRecByEmail, updateRecord };
