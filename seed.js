require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

async function seed() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("❌ Missing MONGO_URI in .env");
    }

    await mongoose.connect(process.env.MONGO_URI);

    await User.deleteMany({});
    await User.insertMany([
      { username: "saud", password: "saud123" },
      { username: "rabait", password: "rabait123" }
    ]);

    console.log("✅ Users seeded: saud / rabait");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding:", err);
    process.exit(1);
  }
}

seed();
