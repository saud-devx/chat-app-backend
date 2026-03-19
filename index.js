require("dotenv").config();
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const app = express();
const server = http.createServer(app);

// --- Allowed Origins for CORS (Render + Vercel) ---
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, "")) // strip trailing slash
  .filter(Boolean);

function isAllowed(origin) {
  if (!origin || ALLOWED_ORIGINS.length === 0) return true;
  const clean = origin.replace(/\/$/, "");
  return ALLOWED_ORIGINS.includes(clean);
}

app.use(express.json());
app.use(
  cors({
    origin: (origin, cb) =>
      isAllowed(origin) ? cb(null, true) : cb(new Error("Not allowed by CORS")),
  })
);

const io = new Server(server, {
  cors: {
    origin: (origin, cb) =>
      isAllowed(origin) ? cb(null, true) : cb(new Error("Not allowed by CORS")),
    methods: ["GET", "POST"],
  },
});

// --- MongoDB connect ---
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/chat-app";
if (!MONGO_URI) {
  console.error("Missing MONGO_URI. Set it in .env or Render env vars.");
  process.exit(1);
}
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

// --- Routes ---
app.get("/", (req, res) => res.send("OK"));
app.get("/health", (req, res) => res.json({ ok: true, time: new Date() }));
app.use("/messages", require("./routes/messages"));
app.use("/auth", require("./routes/auth")); // NEW for login

// --- Socket.IO with JWT Auth ---
const Message = require("./models/Message");
const User = require("./models/User");

// Verify JWT on socket handshake
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("No token"));

  jwt.verify(token, process.env.JWT_SECRET || "supersecret", (err, decoded) => {
    if (err) return next(new Error("Invalid token"));
    socket.user = decoded; // attach user info
    next();
  });
});

io.on("connection", async (socket) => {
  const email = socket.user.email;
  console.log("🔌 User connected:", email);

  // Mark user online
  await User.findOneAndUpdate({ email }, { isOnline: true });
  io.emit("user_status", { email, isOnline: true });

  // Disconnect event inside connection
  socket.on("disconnect", async (reason) => {
    console.log("🔌 User disconnected", email, reason);
    await User.findOneAndUpdate({ email }, { isOnline: false, lastSeen: new Date() });
    io.emit("user_status", { email, isOnline: false, lastSeen: new Date() });
  });

  socket.on("sendMessage", async (msg) => {
    try {
      if (!msg.message) return;

      const newMsg = new Message({
        sender: email,
        message: msg.message,
        status: "sent",
        replyTo: msg.replyTo
      });
      await newMsg.save();

      // Emit new message to others
      socket.broadcast.emit("newMessage", newMsg);
      
      // Acknowledge back to sender with localId for optimistic UI sync
      const ackPayload = newMsg.toObject();
      ackPayload.localId = msg.localId;
      socket.emit("message_ack", ackPayload); 
    } catch (e) {
      console.error("sendMessage error:", e.message);
    }
  });

  socket.on("typing_start", () => {
    socket.broadcast.emit("typing_start", { email });
  });

  socket.on("typing_stop", () => {
    socket.broadcast.emit("typing_stop", { email });
  });

  socket.on("edit_message", async (data) => {
    try {
      const msg = await Message.findOneAndUpdate(
        { _id: data.messageId, sender: email, isDeleted: 'none' },
        { $set: { message: data.newText, isEdited: true } },
        { new: true }
      );
      if (msg) io.emit("message_edited", msg);
    } catch (e) {
      console.error(e);
      
    }
  });

  socket.on("delete_message", async (data) => {
    try {
      if (data.type === 'everyone') {
        const msg = await Message.findOneAndUpdate(
          { _id: data.messageId, sender: email },
          { $set: { isDeleted: 'everyone', message: '🚫 This message was deleted' } },
          { new: true }
        );
        if (msg) io.emit("message_deleted", msg);
      } else if (data.type === 'for_me') {
        const msg = await Message.findByIdAndUpdate(
          data.messageId,
          { $addToSet: { deletedFor: email } },
          { new: true }
        );
        if (msg) socket.emit("message_deleted_forme", { messageId: data.messageId });
      }
    } catch (e) {
      console.error(e);
    }
  });

  socket.on("react_message", async (data) => {
    try {
      const msg = await Message.findById(data.messageId);
      if (msg && msg.isDeleted === 'none') {
        msg.reactions = msg.reactions.filter(r => r.email !== email);
        if (data.emoji) msg.reactions.push({ email, emoji: data.emoji });
        await msg.save();
        io.emit("message_reacted", { messageId: data.messageId, reactions: msg.reactions });
      }
    } catch (e) {
      console.error(e);
    }
  });

  // Handle read receipts
  socket.on("message_read", async (data) => {
    // data should contain message IDs or the sender email
    // We mark messages as read and broadcast the update
    if (data.messageIds && data.messageIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: data.messageIds } },
        { $set: { status: "read" } }
      );
      io.emit("messages_read", { messageIds: data.messageIds, readBy: email });
    }
  });
});

// --- Start Server ---
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`🚀 Server listening on ${PORT}`));
