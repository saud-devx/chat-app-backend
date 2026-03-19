const express = require("express");
const Message = require("../models/Message");
const jwt = require("jsonwebtoken");

const router = express.Router();

// Middleware to check JWT
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token" });

  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET || "supersecret", (err, decoded) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = decoded;
    next();
  });
}

// Get messages with pagination (protected)
router.get("/", authMiddleware, async (req, res) => {
  const { before, limit = 50 } = req.query;
  const query = {};
  if (before) {
    query.timestamp = { $lt: new Date(before) };
  }

  try {
    const msgs = await Message.find(query)
      .sort({ timestamp: -1 }) // Latest first for efficient limit
      .limit(parseInt(limit));
    
    // Return in chronological order
    res.json(msgs.reverse());
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
