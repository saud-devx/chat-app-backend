const express = require("express");
const router = express.Router();
const Message = require("../models/Message");

// get all messages (oldest first)
router.get("/", async (req, res, next) => {
  try {
    const msgs = await Message.find().sort({ timestamp: 1 });
    res.json(msgs);
  } catch (e) { next(e); }
});

module.exports = router;
