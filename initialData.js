const mysql = require("mysql2");
const util = require("util");
// Create a connection pool
const pool = mysql.createPool({
  connectionLimit: 10,
  host: "192.168.121.6",
  user: "root",
  password: "root",
  database: "PROJECT_TIME",
  port: 3306,
});

// Perform database operations
pool.getConnection(async (err, connection) => {
  if (err) {
    console.error("Error connecting to the database:", err);
    return;
  }

  const query = util.promisify(connection.query).bind(connection);

  // create tables
  await query("CREATE TABLE taskData (data JSON);");
  await query("CREATE TABLE projData (data JSON);");
  await query("CREATE TABLE membersData (name VARCHAR(50));");
  await query(
    "CREATE TABLE ETT_PROJ_TIMELOG (PROJTL_ID VARCHAR(50) NOT NULL,ORG_CD VARCHAR(50) NOT NULL,PRSN_CD VARCHAR(50) NOT NULL,CLOCK_DT DATE NOT NULL,PROJ_CD VARCHAR(50) NOT NULL,TASK_CD VARCHAR(50) NOT NULL,TASK_NOTE VARCHAR(2048) NOT NULL,TIME_FROM DATETIME NOT NULL,TIME_TO DATETIME NOT NULL,TOTAL_TIME DECIMAL(12, 3) NOT NULL,CRT_BY_USER VARCHAR(50) NOT NULL,UPD_BY_USER VARCHAR(50) NOT NULL,CRT_BY_TS DATETIME NOT NULL,UPD_BY_TS DATETIME NOT NULL,PRIMARY KEY(PROJTL_ID),CONSTRAINT ETT_PROJ_TL_IX1 UNIQUE(ORG_CD, PRSN_CD, CLOCK_DT, PROJ_CD, TASK_CD)); "
  );

  // insert data
  await query(
    `INSERT INTO taskData (data) VALUES ('{"SUPPORT": "SUPPORT - Support","CONS": "CONS - Consulting","DEV": "DEV - Development"}');`
  );
  await query(
    `INSERT INTO projData (data) VALUES ('{"ACC": "ACC - RI Digitization","GEM": "GoEmed Hosting Support","QSS": "Quadyster - Staffing Support","QTS": "Quadyster - Technology Support"}');`
  );

  await query(
    `INSERT INTO membersData (name) VALUES 
    ("Rohit Panchumarthy"),
    ("Aditya Lonkar"),
    ("Sai Kalyan"),
    ("Sowjanya Tadanki"),
    ("Padma Manda"),
    ("Rahul Namboori"),
    ("Navin Ninan"),
    ("Sheeba Dola"),
    ("Sujatha Mallela");`
  );

  process.exit(0);
});
