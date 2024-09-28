const dayjs = require("dayjs");
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc)
dayjs.extend(timezone)
const mysql = require("mysql2");
const connection = mysql.createPool({
  connectionLimit: 10,
  // host: "192.168.121.6",
  host: "sql.freedb.tech",
  user: "freedb_rohit",
  password: "$G8pt!6av&XRyx&",
  database: "freedb_holidaydb",
  port: 3306,
});


module.exports={dayjs,utc,timezone,connection}