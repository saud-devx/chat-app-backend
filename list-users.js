const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function listUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB...");
    const users = await User.find({}, 'email isOnline lastSeen');
    console.log("Current Users in DB:");
    console.log(JSON.stringify(users, null, 2));
    process.exit(0);
  } catch (err) {
    console.error("Error listing users:", err);
    process.exit(1);
  }
}

listUsers();
