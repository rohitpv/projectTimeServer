var { gDataStore } = require("../index");


var { dayjs, utc, timezone, connection } = require("../db")

module.exports = async function (req, res, next) {
  async function findDataBasedOnTime(payload) {
    sqlQuery = `SELECT * FROM ETT_PROJ_TIMELOG WHERE PRSN_CD=? AND CLOCK_DT=? AND`;

    sqlQuery += `("${payload.TIME_FROM}"<TIME_TO) and ("${payload.TIME_TO}">TIME_FROM)`;

    try {
      return (await connection.promise().query(sqlQuery, [payload.PRSN_CD, payload.CLOCK_DT]))[0]
    } catch (error) {
      if (error.code == "ECONNREFUSED" || error.code == "PROTOCOL_CONNECTION_LOST" ||
        error.code == 'ER_ACCESS_DENIED_ERROR')
        gDataStore.message = [false, "Unable to connect to database."]
      else
        return [false, error]
    }
  }
  async function findDataBasedOnMember(PRSN_CD, CLOCK_DT, PROJ_CD, TASK_CD) {
    let sqlQuery = `SELECT * FROM ETT_PROJ_TIMELOG WHERE PRSN_CD=? AND CLOCK_DT=? AND PROJ_CD=? AND TASK_CD=?`
    try {
      return (await connection.promise().query(sqlQuery, [PRSN_CD, CLOCK_DT, PROJ_CD, TASK_CD]))[0]
    } catch (error) {
      if (error.code == "ECONNREFUSED" || error.code == "PROTOCOL_CONNECTION_LOST" ||
        error.code == 'ER_ACCESS_DENIED_ERROR')
        gDataStore.message = [false, "Unable to connect to database."]
      else
        return [false, error]
    }
  }

  function jsonAttributeToSql(record) {

    newD = {}

    let referenceDictionary = {
      "recordId": "PROJTL_ID",
      "personName": "PRSN_CD",
      "clockDate": "CLOCK_DT",
      "projectName": "PROJ_CD",
      "taskName": "TASK_CD",
      "taskNote": "TASK_NOTE",
      "timeFrom": "TIME_FROM",
      "timeTo": "TIME_TO",
      "totalTime": "TOTAL_TIME",
    }

    for (k in record) { newD[referenceDictionary[k]] = record[k] }

    return newD;
  }
  try {
    gDataStore.message = ["* ", "* "];
    req.body = jsonAttributeToSql(req.body)
    let data = req.body;


    if (req.method == 'POST')
      gDataStore.mode = "add"
    if (req.method == 'PUT')
      gDataStore.mode = "edit"


    if (
      data.CLOCK_DT == "" || data.CLOCK_DT == undefined ||
      data.TASK_NOTE == "" || data.TASK_NOTE == undefined ||
      data.PRSN_CD == "" || data.PRSN_CD == undefined ||
      data.PROJ_CD == "" || data.PROJ_CD == undefined ||
      data.TASK_CD == "" || data.TASK_CD == undefined
    ) {
      gDataStore.message = [false, "All fields required "];
    } else if (
      (data.TIME_FROM == "" || data.TIME_TO == "" || data.TIME_FROM == undefined || data.TIME_TO == undefined) &&
      (data.TOTAL_TIME == "" || data.TOTAL_TIME == undefined)
    ) {
      gDataStore.message = [false, "Time field Required "];
    } else if (gDataStore.mode == "add" && (data.TIME_FROM != "" && data.TIME_FROM != undefined) && (data.TIME_TO != "" && data.TIME_TO != undefined) && (data.TOTAL_TIME != "" && data.TOTAL_TIME != undefined)) {
      gDataStore.message = [false, "Enter only 'time duration' or 'total time'"];
    } else {
      let payload = {
        PRSN_CD: data.PRSN_CD,
        CLOCK_DT: data.CLOCK_DT,
        PROJ_CD: data.PROJ_CD,
        TASK_CD: data.TASK_CD,
        TASK_NOTE: data.TASK_NOTE,
      };
      const timeFormatRegex = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;
      if ((data.TOTAL_TIME != "" || data.TOTAL_TIME != undefined) && (data.TIME_FROM == "" || data.TIME_FROM == undefined) && (data.TIME_TO == "" || data.TIME_TO == undefined)) {
        if (timeFormatRegex.test(data.TOTAL_TIME)) {
          var dateObj = dayjs(new Date(data.CLOCK_DT));
          var st = dateObj.add(0, "hour").add(0, "minute");
          var end = dateObj.add(23, "hour").add(59, "minute");
          var enteredStartTs = st["$d"];
          var enteredEndTs = end["$d"];
          payload.TOTAL_TIME = data.TOTAL_TIME;
          payload.TIME_FROM = dayjs(enteredStartTs).toISOString()
          payload.TIME_TO = dayjs(enteredEndTs).toISOString()
        } else {
          gDataStore.message = [false, "Invalid Time field range "];
        }
      } else {
        if (
          timeFormatRegex.test(data.TIME_FROM) &&
          timeFormatRegex.test(data.TIME_TO)
        ) {
          var [tFromhours, tFromminutes] = data.TIME_FROM.split(":");
          var [tTohours, tTominutes] = data.TIME_TO.split(":");
          let timeMinutes =
            (parseInt(tTohours, 10) - parseInt(tFromhours, 10)) * 60 +
            parseInt(tTominutes, 10) -
            parseInt(tFromminutes, 10);

          let finalHours = Math.floor(timeMinutes / 60);
          let finalMinutes = timeMinutes % 60;
          let TOTAL_TIME = `${String(finalHours).padStart(2, "0")}:${String(
            finalMinutes
          ).padStart(2, "0")}`;


          var dateObj = dayjs(new Date(data.CLOCK_DT));
          var st = dateObj
            .add(parseInt(tFromhours, 10), "hour")
            .add(parseInt(tFromminutes, 10), "minute");
          var end = dateObj
            .add(parseInt(tTohours, 10), "hour")
            .add(parseInt(tTominutes, 10), "minute");
          var enteredStartTs = st["$d"];
          var enteredEndTs = end["$d"];
          payload.TOTAL_TIME = TOTAL_TIME;
          payload.TIME_FROM = dayjs(enteredStartTs).toISOString()
          payload.TIME_TO = dayjs(enteredEndTs).toISOString()
        } else {
          gDataStore.message = [false, "Invalid Time field range "];
        }
      }

      if (enteredStartTs > enteredEndTs) {
        gDataStore.message = [false, " Invalid time [TIME_FROM > TIME_TO]"];
      } else if (gDataStore.mode == "add" && gDataStore.message[0] != false) {
        let response = await findDataBasedOnMember(payload.PRSN_CD, payload.CLOCK_DT, payload.PROJ_CD, payload.TASK_CD)
        if (gDataStore.message[0] != false && response.length != 0) {
          gDataStore.message = [false, "Duplicate entry not allowed "];
        } else {
          let response = await findDataBasedOnTime(payload);
          if (gDataStore.message[0] != false && response.length != 0) {
            gDataStore.message = [false, "Time overlap not allowed "];
          }
        }
      } else if (gDataStore.mode == "edit" && gDataStore.message[0] != false) {
        gDataStore.id = req.params.id
        let sqlQuery = `SELECT * from ETT_PROJ_TIMELOG WHERE PROJTL_ID='${req.params.id}'`;
        pageData = (await connection.promise().query(sqlQuery))[0][0];
        if (pageData == undefined) {
          gDataStore.message = [false, "No record found with given id. "];
          next();
          return;
        }

        const [minutes, seconds] = pageData.TOTAL_TIME.split('.');
        const formattedMinutes = minutes.padStart(2, '0');
        const formattedSeconds = seconds.padStart(2, '0').slice(0, 2);
        pageData.TOTAL_TIME = `${formattedMinutes}:${formattedSeconds}`;

        if (
          data.PRSN_CD == pageData.PRSN_CD &&
          data.PROJ_CD == pageData.PROJ_CD &&
          data.TASK_CD == pageData.TASK_CD &&
          data.TASK_NOTE == pageData.TASK_NOTE &&
          data.CLOCK_DT == dayjs(pageData.CLOCK_DT).format("YYYY-MM-DD") &&
          data.TOTAL_TIME == pageData.TOTAL_TIME &&
          enteredStartTs.toISOString().slice(11, 16) ==
          dayjs(pageData.TIME_FROM).format("HH:mm") &&
          enteredEndTs.toISOString().slice(11, 16) ==
          dayjs(pageData.TIME_TO).format("HH:mm")
        ) {
          gDataStore.message = [false, "No changes to make "];
        } else {
          if (
            data.PRSN_CD != pageData.PRSN_CD ||
            data.PROJ_CD != pageData.PROJ_CD ||
            data.TASK_CD != pageData.TASK_CD ||
            data.CLOCK_DT != dayjs(pageData.CLOCK_DT).format("YYYY-MM-DD")
          ) {
            let response = await findDataBasedOnMember(payload.PRSN_CD, payload.CLOCK_DT, payload.PROJ_CD, payload.TASK_CD)

            if (gDataStore.message[0] != false && response.length != 0) {
              gDataStore.message = [false, "Duplicate entry not allowed "];
            } else {
              let response = await findDataBasedOnTime(payload);
              if (gDataStore.message[0] != false && response.length == 1 && gDataStore.id == response[0].PROJTL_ID) {
              } else if (gDataStore.message[0] != false && response.length > 0) {
                gDataStore.message = [false, "Time overlap not allowed "];
              }
            }
          }
          if ((data.TOTAL_TIME != pageData.TOTAL_TIME ||
            enteredStartTs.toISOString().slice(11, 16) != dayjs(pageData.TIME_FROM).format("HH:mm") ||
            enteredEndTs.toISOString().slice(11, 16) != dayjs(pageData.TIME_TO).format("HH:mm")) &&
            (data.TIME_FROM != "" && data.TIME_FROM != undefined) && (data.TIME_TO != "" && data.TIME_TO != undefined) && (data.TOTAL_TIME != "" && data.TOTAL_TIME != undefined)
          ) {
            gDataStore.message = [false, "Enter only 'time duration' or 'total time'"];
          } else {
            let response = await findDataBasedOnTime(payload);
            if (gDataStore.message[0] != false && response.length == 1 && response[0].PROJTL_ID == gDataStore.id) {
            } else if (gDataStore.message[0] != false && response.length > 0) {
              gDataStore.message = [false, "Time overlap not allowed "];
            }
          }
        }
      }
    }
    if (gDataStore.mode == "add" && gDataStore.message[0] != false) {
      gDataStore.message = [true, "Record added successfully"];
    } else if (gDataStore.mode == "edit" && gDataStore.message[0] != false) {
      gDataStore.message = [true, "Record updated successfully"];
      gDataStore.mode = "editFromSuccessfulUpdate"
    }

  } catch (error) {
    if (error.code == "ECONNREFUSED" || error.code == "PROTOCOL_CONNECTION_LOST" ||
      error.code == 'ER_ACCESS_DENIED_ERROR')
      gDataStore.message = [false, "Unable to connect to database."]
    else
      console.log("ERROR: ", error);
  }
  next();
};
