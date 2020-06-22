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

module.exports = { loadSubmissions, getDataById };
