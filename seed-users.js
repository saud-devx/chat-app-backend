const mongoose = require('mongoose');
const argon2 = require('argon2');
require('dotenv').config();

const User = require('./models/User');

const users = [
  {
    email: 'maryamawais.dev@gmail.com',
    password: 'maryam@928'
  },
  {
    email: 'saud.devx@gmail.com',
    password: 'saud@928'
  }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/chat-app");
    console.log("Connected to MongoDB for seeding...");

    // Upsert users instead of deleting
    for (const u of users) {
      const hashedPassword = await argon2.hash(u.password);
      await User.findOneAndUpdate(
        { email: u.email.toLowerCase() },
        { password: hashedPassword },
        { upsert: true, new: true }
      );
      console.log(`Upserted user: ${u.email}`);
    }

    console.log("Seeding completed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Seeding error:", err);
    process.exit(1);
  }
}

seed();
