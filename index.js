const express = require("express");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const cors=require('cors')

const app = express();
var gDataStore = {};
// module.exports = { gDataStore };
module.exports.handler = async (event, context) => {
  return gDataStore;
};
dayjs.extend(utc);

app.use(cors({
    origin: "*"
}))

app.use("/", require("./routes/projectTimeRoutes"));
app.listen(4000, () => console.log("App listening on port 4000"));

