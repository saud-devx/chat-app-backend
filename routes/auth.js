const express = require("express");
const jwt = require("jsonwebtoken");
const argon2 = require("argon2");
const User = require("../models/User");

const router = express.Router();

// POST /auth/register
router.post("/register", async (req, res) => {
  const { username, password } = req.body;

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const hashedPassword = await argon2.hash(password);
    const user = new User({ username, password: hashedPassword });
    await user.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// POST /auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    let isMatch = false;

    // Support existing accounts on the live DB that use plain text passwords
    if (!user.password.startsWith("$argon2")) {
      if (user.password === password) {
        isMatch = true;
        // Transparently upgrade the user's password to argon2
        user.password = await argon2.hash(password);
        await user.save();
      }
    } else {
      isMatch = await argon2.verify(user.password, password);
    }

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET || "supersecret",
      { expiresIn: "6h" }
    );

    res.json({ token, username: user.username });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// POST /auth/logout
router.post("/logout", (req, res) => {
  // In a stateless JWT setup, we mainly clear the token on the frontend.
  // This endpoint can be used for server-side logic (e.g., status updates)
  res.json({ message: "Logout successful" });
});

module.exports = router;
