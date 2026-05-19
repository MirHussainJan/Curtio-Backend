const mongoose = require("mongoose");
const env = require("./config.js/env");
const User = require("./models/User");

async function test() {
  try {
    await mongoose.connect(env.DB_URL);
    console.log("Connected to DB");
    
    const user = await User.findOne({ email: "test@example.com" });
    console.log("Found user:", user);

    const bcrypt = require("bcryptjs");
    const hashedPassword = await bcrypt.hash("password123", 12);
    console.log("Hashed password:", hashedPassword);

    const newUser = await User.create({
      name: "Test",
      email: "test" + Date.now() + "@example.com",
      password: hashedPassword,
      otp: "123456",
      otpExpiry: new Date(Date.now() + 10 * 60 * 1000),
    });
    console.log("Created user:", newUser._id);
    
    process.exit(0);
  } catch (error) {
    console.error("Error occurred:", error);
    process.exit(1);
  }
}

test();
