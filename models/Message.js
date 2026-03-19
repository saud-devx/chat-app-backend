const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  sender: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
  isDeleted: { type: String, enum: ['everyone', 'none'], default: 'none' },
  deletedFor: [{ type: String }],
  isEdited: { type: Boolean, default: false },
  replyTo: { type: mongoose.Schema.Types.Mixed },
  reactions: [{ username: String, emoji: String }],
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Message", MessageSchema);
