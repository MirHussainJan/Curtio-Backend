const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const env = require("./config.js/env");
const User = require("./models/User");

const seedUser = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(env.DB_URL);
    console.log("✅ Connected!");

    const testEmail = "test@example.com";

    // Check if user already exists
    const existing = await User.findOne({ email: testEmail });
    if (existing) {
      console.log("User already exists in DB. Deleting it to refresh...");
      await User.deleteOne({ email: testEmail });
    }

    const hashedPassword = await bcrypt.hash("password123", 12);

    await User.create({
      name: "Test User",
      email: testEmail,
      password: hashedPassword,
      isVerified: true, // Directly mark as verified for easy testing
    });

    console.log("-----------------------------------------");
    console.log("🎉 SUCCESS: Test User added to Atlas!");
    console.log("Email: test@example.com");
    console.log("Password: password123");
    console.log("-----------------------------------------");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
};

seedUser();
