const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // hashed with argon2
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  otp: { type: String },
  otpExpires: { type: Date }
});

module.exports = mongoose.model("User", userSchema);
