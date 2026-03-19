const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // hashed with argon2
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", userSchema);
