const mongoose = require("mongoose");
const env = require("./env");

const connectDB = async () => {
  try {
    await mongoose.connect(env.DB_URL);

    console.log("MongoDB Connected");
  } catch (error) {
    console.log("Error while connecting to MongoDB", error);
  }
};

module.exports = connectDB;