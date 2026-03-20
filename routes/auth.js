const express = require("express");
const jwt = require("jsonwebtoken");
const argon2 = require("argon2");
const { Resend } = require("resend");
const User = require("../models/User");

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

// POST /auth/register
router.post("/register", async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = email.toLowerCase();

  try {
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const hashedPassword = await argon2.hash(password);
    const user = new User({ email: normalizedEmail, password: hashedPassword });
    await user.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// POST /auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = email.toLowerCase();

  try {
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      console.log(`[Login Debug] User NOT found: ${normalizedEmail}`);
      return res.status(401).json({ error: "Invalid credentials (User not found)" });
    }

    let isMatch = false;
    if (!user.password.startsWith("$argon2")) {
      console.log(`[Login Debug] Falling back to plain text check for: ${normalizedEmail}`);
      if (user.password === password) {
        isMatch = true;
        user.password = await argon2.hash(password);
        await user.save();
      }
    } else {
      isMatch = await argon2.verify(user.password, password);
    }

    if (!isMatch) {
      console.log(`[Login Debug] Password mismatch for: ${normalizedEmail}`);
      return res.status(401).json({ error: "Invalid credentials (Password mismatch)" });
    }

    // --- OTP Generation ---
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    // --- Send OTP via Resend ---
    try {
      await resend.emails.send({
        from: 'ChatApp <onboarding@resend.dev>',
        to: user.email,
        subject: 'Your Login OTP - ChatApp',
        html: `<p>Welcome back! Your OTP for ChatApp is: <strong>${otp}</strong>. It expires in 10 minutes.</p>`
      });
      res.json({ status: "pending_otp", message: "OTP sent to your email" });
    } catch (emailErr) {
      console.error("Resend Error:", emailErr);
      res.status(500).json({ error: "Failed to send OTP email" });
    }
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// POST /auth/verify-otp
router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  const normalizedEmail = email.toLowerCase();

  try {
    const user = await User.findOne({ email: normalizedEmail });
    if (!user || user.otp !== otp || user.otpExpires < new Date()) {
      console.log(`[Verify-OTP] Failed for: ${normalizedEmail}`);
      return res.status(401).json({ error: "Invalid or expired OTP" });
    }

    // Clear OTP after successful verification
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || "supersecret",
      { expiresIn: "6h" }
    );

    res.json({ token, email: user.email, message: "User authenticated successfully with OTP" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// POST /auth/logout
router.post("/logout", (req, res) => {
  res.json({ message: "Logout successful" });
});

module.exports = router;
