/**
 * Data Sockets
 */

const config = require('../config')
const airtable = require('airtable')

const base = new airtable({ apiKey: config.airtable.key }).base(
  config.airtable.base
)

const onboard = async (eventName, email) => {
  return new Promise((resolve, reject) => {
    base('Submissions').create(
      [
        {
          fields: {
            'Event Name': eventName,
            'Contact Email': email
          }
        }
      ],
      function (err, records) {
        if (err) {
          console.log(err)
          reject(err)
        }

        resolve(records[0].getId())
      }
    )
  })
}

// Promise to convert Airtable data into json stream
const loadSubmissions = async () => {
  const recList = []
  await base('Submissions')
    .select({
      view: 'Grid view'
    })
    .all()
    .then((records) => {
      for (let i = 0; i < records.length; i++) {
        records[i]._rawJson.fields.id = records[i]._rawJson.id
        recList.push(records[i]._rawJson.fields)
      }
    })
    .catch(function () {
      console.log('Promise Rejected')
    })

  return recList
}

const loadPublicData = async () => {
  const publicList = []

  await base('Submissions')
    .select({
      view: 'Grid view',
      filterByFormula: `{ShowLogo} = 1`
    })
    .all()
    .then((records) => {
      for (const i in records) {
        const r = records[i]._rawJson.fields

        if (r['Logo']) {
          publicList.push({
            name: r['Event Name'],
            website: r['Website'],
            logo: r['Logo'] ? r['Logo'][0]['url'] : null
          })
        }
      }
    })
    .catch(function (e) {
      console.log('Promise Rejected' + e)
    })

  return publicList
}

const getDataById = async (rid) => {
  const data = []

  await base('Submissions')
    .find(rid)
    .then((record) => {
      record._rawJson.fields.id = record._rawJson.id
      data.push(record._rawJson.fields)
    })
    .catch(function () {
      console.log('Promise Rejected')
    })

  return data
}

const getRecByEmail = async (email) => {
  return new Promise((resolve, reject) => {
    let results = base('Submissions')
      .select({
        view: 'Incomplete',
        filterByFormula: `{Contact Email} = "${email}"`
      })
      .all()

    resolve(results)
  })
}

const updateRecord = async (rid, d) => {
  return new Promise((resolve, reject) => {
    base('Submissions').update(
      rid,
      {
        Complete: true,
        Website: d.website,
        Scope: d.scope,
        'Demographic Restrictions': d.demRes,
        Finaid: d.finaid,
        'Application Tags': d.application,
        Budget: d.budget,
        Marketing: d.marketing,
        Mentors: d.mentors === 'TRUE',
        Workshops: d.workshops === 'TRUE',
        'Lead Profiles': d.displayLead === 'TRUE',
        Leadership: d.leadership,
        Attrition: 1 - Number(d.attendance) / 100,
        'Projects Submitted': d.projects
      },
      { typecast: true },
      function (err, record) {
        if (err) {
          reject(err)
          console.log(err)
        }

        resolve()
      }
    )
  })
}

const updateStats = async (rid, d) => {
  return new Promise((resolve, reject) => {
    base('Submissions').update(
      rid,
      {
        Registered: d.registered,
        Attended: d.attended,
        GenderURM: d.genderURM,
        RacialURM: d.racialURM
      },
      { typecast: true },
      function (err, record) {
        if (err) {
          reject(err)
          console.log(err)
        }

        resolve()
      }
    )
  })
}

module.exports = {
  onboard,
  loadSubmissions,
  loadPublicData,
  getDataById,
  getRecByEmail,
  updateRecord,
  updateStats
}
