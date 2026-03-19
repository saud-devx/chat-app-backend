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

    // Delete all users
    await User.deleteMany({});
    console.log("Deleted all existing users.");

    // Drop legacy indexes
    try {
      await User.collection.dropIndexes();
      console.log("Dropped legacy indexes.");
    } catch (e) {
      console.log("No indexes to drop or error dropping indexes (safe to ignore if collection is new).");
    }

    for (const u of users) {
      const hashedPassword = await argon2.hash(u.password);
      const newUser = new User({
        email: u.email,
        password: hashedPassword
      });
      await newUser.save();
      console.log(`Created user: ${u.email}`);
    }

    console.log("Seeding completed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Seeding error:", err);
    process.exit(1);
  }
}

seed();
