const express = require("express");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const cors=require('cors')

const app = express();
var gDataStore = {};

exports.gDataStore = gDataStore; // Export gDataStore explicitly
exports.handler = async (event) => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Success", data: gDataStore }),
  };
};

dayjs.extend(utc);

app.use(cors({
    origin: "*"
}))

app.use("/", require("./routes/projectTimeRoutes"));
app.listen(4000, () => console.log("App listening on port 4000"));

