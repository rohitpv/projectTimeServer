const express = require("express");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const cors=require('cors')

const app = express();

// ************
// const { gDataStore } = require('./gDataStore'); // Import your gDataStore

// exports.handler = async (req, res) => {
//   // Your Lambda or Vercel handler logic here
//   res.status(200).json({ message: 'Success', data: gDataStore });
// };

// ************

dayjs.extend(utc);

app.use(cors({
    origin: "*"
}))

app.use("/", require("./routes/projectTimeRoutes"));
app.listen(4000, () => console.log("App listening on port 4000"));

