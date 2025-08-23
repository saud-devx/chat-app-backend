const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // plaintext for now, later bcrypt
});

module.exports = mongoose.model("User", userSchema);
