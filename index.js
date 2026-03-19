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
  const username = socket.user.username;
  console.log("🔌 User connected:", username);

  // Mark user online
  await User.findOneAndUpdate({ username }, { isOnline: true });
  io.emit("user_status", { username, isOnline: true });

  // Disconnect event inside connection
  socket.on("disconnect", async (reason) => {
    console.log("🔌 User disconnected", username, reason);
    await User.findOneAndUpdate({ username }, { isOnline: false, lastSeen: new Date() });
    io.emit("user_status", { username, isOnline: false, lastSeen: new Date() });
  });

  socket.on("sendMessage", async (msg) => {
    try {
      if (!msg.message) return;

      const newMsg = new Message({
        sender: username,
        message: msg.message,
        status: "sent"
      });
      await newMsg.save();

      // Emit new message to others
      socket.broadcast.emit("newMessage", newMsg);
      // Acknowledge back to sender
      socket.emit("message_ack", newMsg); 
    } catch (e) {
      console.error("sendMessage error:", e.message);
    }
  });

  socket.on("typing_start", () => {
    socket.broadcast.emit("typing_start", { username });
  });

  socket.on("typing_stop", () => {
    socket.broadcast.emit("typing_stop", { username });
  });

  // Handle read receipts
  socket.on("message_read", async (data) => {
    // data should contain message IDs or the sender username
    // We mark messages as read and broadcast the update
    if (data.messageIds && data.messageIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: data.messageIds } },
        { $set: { status: "read" } }
      );
      io.emit("messages_read", { messageIds: data.messageIds, readBy: username });
    }
  });
});

// --- Start Server ---
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`🚀 Server listening on ${PORT}`));
