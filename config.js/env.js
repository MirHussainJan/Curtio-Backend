const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const env = {
  PORT: process.env.PORT,
  AppEmail: process.env.EMAIL_USER,
  AppPassward: process.env.EMAIL_PASS,
  DB_URL: process.env.DB_URL,
  JWT_SECRET: process.env.JWT_SECRET,
};

module.exports = env;
