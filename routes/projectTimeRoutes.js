const express = require("express");
const bodyParser = require("body-parser");
var { gDataStore } = require("../gDataStore");
const uniqid = require("uniqid");
let validationMiddleware = require("../middleware/validationMiddleware");

const router = express.Router();
router.use(express.json());
router.use(bodyParser.json({ limit: "50mb" }));
router.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

var { dayjs, utc, timezone, connection } = require("../db");
async function fetchReferenceData() {
  try {
    gDataStore.membersData = (
      await connection.promise().query("SELECT * from membersData")
    )[0];
    gDataStore.taskData = (
      await connection.promise().query("SELECT * from taskData")
    )[0];
    gDataStore.projData = (
      await connection.promise().query("SELECT * from projData")
    )[0];
  } catch (error) {
    if (
      error.code == "ECONNREFUSED" ||
      error.code == "PROTOCOL_CONNECTION_LOST"||
      error.code == 'ER_ACCESS_DENIED_ERROR'
    )
      gDataStore.message = [false, "Unable to connect to database."];
  }
}

async function getProjectData(pageFilterQuery) {
  sqlQuery =
    "SELECT PRSN_CD, JSON_OBJECTAGG(CLOCK_DT, records) AS subgroups FROM (SELECT PRSN_CD,CLOCK_DT, JSON_ARRAYAGG(json_object('PROJTL_ID', PROJTL_ID,'PRSN_CD', PRSN_CD,'CLOCK_DT', CLOCK_DT,'TASK_NOTE', TASK_NOTE,'PROJ_CD', PROJ_CD,'TASK_CD', TASK_CD,'TIME_FROM', TIME_FROM,'TIME_TO', TIME_TO,'TOTAL_TIME', TOTAL_TIME)) AS records FROM ETT_PROJ_TIMELOG" +
    pageFilterQuery +
    " GROUP BY PRSN_CD,CLOCK_DT) AS subgroups2 GROUP BY PRSN_CD";
  try {
    response = (await connection.promise().query(sqlQuery))[0];
    return [true, response];
  } catch (error) {
    if (
      error.code == "ECONNREFUSED" ||
      error.code == "PROTOCOL_CONNECTION_LOST" ||
      error.code == 'ER_ACCESS_DENIED_ERROR'
    )
      return [false, "Unable to connect to database."+error];
      return [false, error];
  }
}

function timeToMinutes(time) {
  var [hours, minutes] = time.split(":");
  return parseInt(hours, 10) * 60 + parseInt(minutes, 10);
}
function calculateTotalTimeFromArray(inputArray) {
  let totalMin = 0;
  inputArray.forEach((timeValue) => {
    totalMin += timeToMinutes(timeValue);
  });
  var hours = Math.floor(totalMin / 60);
  var minutes = totalMin % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}`;
}

function sqlToJsonAttribute(record) {
  newD = {}

  let referenceDictionary = {
    "PROJTL_ID": "recordId",
    "PRSN_CD": "personName",
    "CLOCK_DT": "clockDate",
    "PROJ_CD": "projectName",
    "TASK_CD": "taskName",
    "TASK_NOTE": "taskNote",
    "TIME_FROM": "timeFrom",
    "TIME_TO": "timeTo",
    "TOTAL_TIME": "totalTime",
  }

  for (k in record) {
    newD[referenceDictionary[k]] = record[k]
  }

  return newD;
}

function changeListDataFormat(dataRecords) {
  dataRecordsDictionary = {}
  let sameDateTtimeArray = [];
  let sameMemberTtimeArray = [];
  dataRecordsDictionary.memberSum = {};
  dataRecordsDictionary.memberTotalSum = {};

  for (i = 0; i < dataRecords.length; i++) {
    let timeSum = {};
    sameMemberTtimeArray = [];

    dataRecords[i].personName = dataRecords[i].PRSN_CD
    delete dataRecords[i].PRSN_CD

    for (j = 0; j < Object.entries(dataRecords[i].subgroups).length; j++) {
      sameDateTtimeArray = [];
      let dateKey = Object.entries(dataRecords[i].subgroups)[j][0];
      for (kTemp = 0; kTemp < dataRecords[i].subgroups[dateKey].length; kTemp++) {
        var [hours, minutes] = String(dataRecords[i].subgroups[dateKey][kTemp].TOTAL_TIME).split(".");
        if (hours == undefined) hours = "0";
        if (minutes == undefined) minutes = "0";
        const formattedHours = hours.padStart(2, "0").slice(0, 2);
        const formattedMinutes = minutes.padEnd(2, "0");
        dataRecords[i].subgroups[dateKey][kTemp].TOTAL_TIME = `${formattedHours}:${formattedMinutes}`;

        sameDateTtimeArray.push(dataRecords[i].subgroups[dateKey][kTemp].TOTAL_TIME);
        dataRecords[i].subgroups[dateKey][kTemp].CLOCK_DT = dayjs(dataRecords[i].subgroups[dateKey][kTemp].CLOCK_DT).format("YYYY-MM-DD");
        dataRecords[i].subgroups[dateKey][kTemp].TIME_FROM = dataRecords[i].subgroups[dateKey][kTemp].TIME_FROM.slice(11, 16);
        dataRecords[i].subgroups[dateKey][kTemp].TIME_TO = dataRecords[i].subgroups[dateKey][kTemp].TIME_TO.slice(11, 16);
        dataRecords[i].subgroups[dateKey][kTemp] = sqlToJsonAttribute(dataRecords[i].subgroups[dateKey][kTemp])
      }
      sameDateResult = calculateTotalTimeFromArray(sameDateTtimeArray);
      sameMemberTtimeArray.push(sameDateResult);
      timeSum[dateKey] = sameDateResult;
    }
    sameMemberResult = calculateTotalTimeFromArray(sameMemberTtimeArray); //IMP
    dataRecordsDictionary.memberSum[dataRecords[i].personName] = timeSum;
    dataRecordsDictionary.memberTotalSum[dataRecords[i].personName] = sameMemberResult;
  }
  dataRecordsDictionary.dataRecords = dataRecords

  return dataRecordsDictionary;
}

// get all records
router.get("/", async (req, res) => {

  gDataStore.message = ["* ", "* "];
  statusCode = 100
  try {
      if (gDataStore.taskData == undefined) await fetchReferenceData();
      [isSuccess, value] = await getProjectData("");
      if (value.length == 0) {
        gDataStore.message = [false, "No Records found"]
        statusCode = 400
      }
      else if (isSuccess) {
        gDataStore.message = [false, "Successfully fetched all records"]
        value = changeListDataFormat(value);
        statusCode = 200
      }
      else
        statusCode = 400
    return res.status(statusCode).json({ "message": gDataStore.message[1], "statusCode": statusCode, "data": value });
  } catch (error) {
    res.status(400).send({ "message": error, "statusCode": 400 });
  }
});

// filtered record
router.get("/project-record", async (req, res) => {
  gDataStore.message = ["* ", "* "];
  statusCode = 100
  try {
      if (gDataStore.taskData == undefined) await fetchReferenceData();
      let FILTER_DATE_FROM = req.query.dateFrom;
      let FILTER_DATE_TO = req.query.dateTo;
      let queryStringCondition = " WHERE ";
      if (FILTER_DATE_FROM != "" && FILTER_DATE_TO != "")
        queryStringCondition += `CLOCK_DT >= '${FILTER_DATE_FROM}' AND CLOCK_DT <= '${FILTER_DATE_TO}'`;
      else if (FILTER_DATE_FROM != "")
        queryStringCondition += `CLOCK_DT >= '${FILTER_DATE_FROM}'`;
      else if (FILTER_DATE_TO != "")
        queryStringCondition += `CLOCK_DT <= '${FILTER_DATE_TO}'`;
      if (req.query.memberName != "All Members") {
        if (queryStringCondition != " WHERE ") queryStringCondition += " AND";
        queryStringCondition += ` PRSN_CD = '${req.query.memberName}'`;
      }
      if (req.query.project != "All Projects") {
        if (queryStringCondition != " WHERE ") queryStringCondition += " AND";
        queryStringCondition += ` PROJ_CD = '${req.query.project}'`;
      }

      [isSuccess, value] = await getProjectData(queryStringCondition);
      if (value.length == 0) {
        statusCode = 400
        gDataStore.message = [false, "No Records found"]
      }
      else if (isSuccess) {
        gDataStore.message = [true, "Successfully fetched all records"]
        value = changeListDataFormat(value);
        statusCode = 200
      }
      else {
        statusCode = 500
        gDataStore.message = [false, "Unable to connect to database."];
      }
    return res.status(statusCode).send({ "message": gDataStore.message[1], "statusCode": statusCode, "data": value });
  } catch (error) {
    res.status(400).send({ "message": error.message, "statusCode": 400 });
  }
});

function calculateTtimeFromRange(payload, TIME_FROM, TIME_TO, date) {
  var [tFromhours, tFromminutes] = TIME_FROM.split(":");
  var [tTohours, tTominutes] = TIME_TO.split(":");
  let timeMinutes =
    (parseInt(tTohours, 10) - parseInt(tFromhours, 10)) * 60 +
    parseInt(tTominutes, 10) -
    parseInt(tFromminutes, 10);

  let finalHours = Math.floor(timeMinutes / 60);
  let finalMinutes = timeMinutes % 60;
  let totalTime = `${String(finalHours).padStart(2, "0")}.${String(
    finalMinutes
  ).padStart(2, "0")}`;

  payload.TOTAL_TIME = totalTime;

  var dateObj = dayjs(new Date(date));
  var st = dateObj
    .add(parseInt(tFromhours, 10), "hour")
    .add(parseInt(tFromminutes, 10), "minute")
    .toISOString();
  var end = dateObj
    .add(parseInt(tTohours, 10), "hour")
    .add(parseInt(tTominutes, 10), "minute")
    .toISOString();

  payload.duration = [
    st.replace("T", " ").replace("Z", ""),
    end.replace("T", " ").replace("Z", ""),
  ];

  return [payload.TOTAL_TIME, payload.duration]
}

function calculateDurationFromTtime(date) {
  const dateObj = dayjs.utc(new Date(date));
  const st = dateObj.add(0, "hour").add(0, "minute").toISOString();
  const end = dateObj.add(23, "hour").add(59, "minute").toISOString();
  return [
    st.replace("T", " ").replace("Z", ""),
    end.replace("T", " ").replace("Z", ""),
  ];
}

function formatData(temp) {
  pageData = {};
  pageData.PROJTL_ID = temp[0].PROJTL_ID
  pageData.CLOCK_DT = dayjs(temp[0].CLOCK_DT).format("YYYY-MM-DD");
  pageData.TASK_NOTE = temp[0].TASK_NOTE;
  pageData.PRSN_CD = temp[0].PRSN_CD;
  pageData.PROJ_CD = temp[0].PROJ_CD;
  pageData.TASK_CD = temp[0].TASK_CD;
  pageData.TIME_FROM = dayjs(temp[0].TIME_FROM).format("HH:mm");
  pageData.TIME_TO = dayjs(temp[0].TIME_TO).format("HH:mm");
  const [minutes, seconds] = temp[0].TOTAL_TIME.split(".");
  const formattedMinutes = minutes.padStart(2, "0");
  const formattedSeconds = seconds.padStart(2, "0").slice(0, 2);
  pageData.TOTAL_TIME = `${formattedMinutes}:${formattedSeconds}`;

  return pageData;
}

// add record
router.post("/project-record", [validationMiddleware], async (req, res) => {

  if (gDataStore.taskData == undefined) await fetchReferenceData();

  pageData = req.body;
  if (req.headers.accept != 'application/json' || req.headers['content-type'] != 'application/json') {
    gDataStore.message = [false, "Not a supported header type."];
  }
  else if (gDataStore.message[0] != false) {
    let payload = {};

    if (pageData.TOTAL_TIME != "" && pageData.TOTAL_TIME != undefined) {
      const date = dayjs.utc(new Date(pageData.CLOCK_DT));
      payload.duration = calculateDurationFromTtime(date);
      payload.TOTAL_TIME = pageData.TOTAL_TIME.replace(":", ".");
    } else {
      [payload.TOTAL_TIME, payload.duration] = calculateTtimeFromRange(payload, pageData.TIME_FROM, pageData.TIME_TO, pageData.CLOCK_DT);
    }

    payload.CLOCK_DT = new Date(pageData.CLOCK_DT);
    payload.TASK_NOTE = pageData.TASK_NOTE;
    payload.PRSN_CD = pageData.PRSN_CD;
    payload.PROJ_CD = pageData.PROJ_CD;
    payload.TASK_CD = pageData.TASK_CD;
    payload.PROJTL_ID = uniqid();

    let sqlQuery =
      'INSERT INTO ETT_PROJ_TIMELOG (PROJTL_ID,ORG_CD,PRSN_CD,CLOCK_DT,PROJ_CD,TASK_CD,TASK_NOTE,TIME_FROM,TIME_TO,TOTAL_TIME,CRT_BY_USER,UPD_BY_USER,CRT_BY_TS,UPD_BY_TS) VALUES (?,"QUADYSTER R3SERVICES",?,?,?,?,?,?,?,?,"rpanchumarthy","rpanchumarthy",CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)';

    try {
      response = (
        await connection
          .promise()
          .query(sqlQuery, [payload.PROJTL_ID, payload.PRSN_CD, payload.CLOCK_DT, payload.PROJ_CD, payload.TASK_CD, payload.TASK_NOTE, payload.duration[0], payload.duration[1], payload.TOTAL_TIME])
      )[0];
    } catch (error) {
      if (error.code == "ECONNREFUSED" || error.code == "PROTOCOL_CONNECTION_LOST" ||
      error.code == 'ER_ACCESS_DENIED_ERROR')
        gDataStore.message = [false, "Unable to connect to database."];
      return res.status(500).send({ "message": gDataStore.message[1], "statusCode": 500 });
    }
    payload.TIME_FROM = payload.duration[0]
    payload.TIME_TO = payload.duration[1]
    payload.duration = undefined
    payload = formatData([payload])
    payload = sqlToJsonAttribute(payload)
    return res.status(200).send({ "message": gDataStore.message[1], "statusCode": 200, "data": payload });
  }
  return res.status(400).send({ "message": gDataStore.message[1], "statusCode": 400 });
});

// edit record
router.put("/project-record/:id", [validationMiddleware], async (req, res) => {
  if (gDataStore.taskData == undefined) await fetchReferenceData();
  gDataStore.id = req.params.id

  pageData = req.body;

  if (req.headers.accept != 'application/json' || req.headers['content-type'] != 'application/json') {
    gDataStore.message = [false, "Not a supported header type."];
  }
  else if (gDataStore.message[0] != false) {
    let payload = {};
    if (pageData.TIME_FROM != "" && pageData.TIME_FROM != undefined && pageData.TIME_TO != "" && pageData.TIME_TO != undefined) {
      [payload.TOTAL_TIME, payload.duration] = calculateTtimeFromRange(payload, pageData.TIME_FROM, pageData.TIME_TO, pageData.CLOCK_DT);
    } else if (pageData.TOTAL_TIME != "" && pageData.TOTAL_TIME != undefined && (pageData.TIME_FROM == "" || pageData.TIME_FROM == undefined) && (pageData.TIME_TO == "" || pageData.TIME_TO == undefined)) {
      const date = new Date(pageData.CLOCK_DT);
      payload.duration = calculateDurationFromTtime(date);
      payload.TOTAL_TIME = pageData.TOTAL_TIME;
    } else {
      [payload.TOTAL_TIME, payload.duration] = calculateTtimeFromRange(payload, pageData.TIME_FROM, pageData.TIME_TO, pageData.CLOCK_DT);
    }
    payload.TOTAL_TIME = payload.TOTAL_TIME.replace(":", ".");

    payload.CLOCK_DT = new Date(pageData.CLOCK_DT);
    payload.TASK_NOTE = pageData.TASK_NOTE;
    payload.PRSN_CD = pageData.PRSN_CD;
    payload.PROJ_CD = pageData.PROJ_CD;
    payload.TASK_CD = pageData.TASK_CD;
    payload.PROJTL_ID = req.params.id;

    let sqlQuery = `UPDATE ETT_PROJ_TIMELOG SET PRSN_CD=?, CLOCK_DT=?, PROJ_CD=?, TASK_CD=?, TASK_NOTE=?, TIME_FROM=?, TIME_TO=?, TOTAL_TIME=? WHERE PROJTL_ID = '${req.params.id}'`;

    try {
      response = (
        await connection
          .promise()
          .query(sqlQuery, [payload.PRSN_CD, payload.CLOCK_DT, payload.PROJ_CD, payload.TASK_CD, payload.TASK_NOTE, payload.duration[0], payload.duration[1], payload.TOTAL_TIME,])
      )[0];
    } catch (error) {
      if (error.code == "ER_DUP_ENTRY")
        gDataStore.message = [false, "Duplicate entry not allowed "];
    }

    pageData.TIME_FROM = payload.duration[0].slice(11, 16);
    pageData.TIME_TO = payload.duration[1].slice(11, 16);
    pageData.TOTAL_TIME = payload.TOTAL_TIME;
    if (gDataStore.message[0]) {
      payload.TIME_FROM = payload.duration[0]
      payload.TIME_TO = payload.duration[1]
      payload.duration = undefined
      payload = formatData([payload])
      payload = sqlToJsonAttribute(payload)
      return res.status(200).send({ "message": gDataStore.message[1], "statusCode": 200, "data": payload });
    }
  }

  if (gDataStore.message[1] == "Unable to connect to database.") {
    return res.status(500).send({ "message": gDataStore.message[1], "statusCode": 500 });
  }
  else {
    return res.status(400).send({ "message": gDataStore.message[1], "statusCode": 400 });
  }

});

// view record
router.get("/project-record/:id", async (req, res) => {
  gDataStore.message = ["* ", "* "];
  statusCode = 100
  let sqlQuery = `SELECT * from ETT_PROJ_TIMELOG WHERE PROJTL_ID='${req.params.id}'`;

  if (req.headers.accept != 'application/json') {
    statusCode = 400
    gDataStore.message = [false, "Not a supported header type."];
  }
  else {
    try {
      result = (await connection.promise().query(sqlQuery))[0];
      if (result == undefined || result.length == 0) {
        gDataStore.message = [false, "No record found with given id. "];
        statusCode = 400
      }
      else {
        result = formatData(result);
        result = sqlToJsonAttribute(result)

        gDataStore.message = [true, "Successfully fetched record with given id"];
        statusCode = 200
      }
    } catch (error) {
      if (
        error.code == "ECONNREFUSED" ||
        error.code == "PROTOCOL_CONNECTION_LOST"||
        error.code == 'ER_ACCESS_DENIED_ERROR'
      )
        gDataStore.message = [false, "Unable to connect to database."];
      statusCode = 500
    }
  }

  return res.status(statusCode).send({ "message": gDataStore.message[1], "statusCode": statusCode, "data": result });
});

// delete record
router.delete("/project-record/:id", async (req, res) => {
  let sqlQuery = `DELETE FROM ETT_PROJ_TIMELOG WHERE PROJTL_ID='${req.params.id}'`;
  if (req.headers.accept != 'application/json') {
    statusCode = 400
    gDataStore.message = [false, "Not a supported header type."];
  }
  else {
    try {
      result = (await connection.promise().query(sqlQuery))[0];
      if (result.affectedRows == 0) {
        gDataStore.message = [false, "No record found with given id. "];
        statusCode = 400
      }
      else {
        gDataStore.message = [true, "Record deleted successfully."];
        statusCode = 200
      }
    } catch (error) {
      if (
        error.code == "ECONNREFUSED" ||
        error.code == "PROTOCOL_CONNECTION_LOST"||
        error.code == 'ER_ACCESS_DENIED_ERROR'
      )
        gDataStore.message = [false, "Unable to connect to database."];
      statusCode = 500
    }
  }

  return res.status(statusCode).send({ "message": gDataStore.message[1], "statusCode": statusCode });
});

module.exports = router;
