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
const { MONGO_URI } = process.env;
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

io.on("connection", (socket) => {
  console.log("🔌 User connected:", socket.user.username);

  socket.on("sendMessage", async (msg) => {
    try {
      if (!msg.message) return;

      const newMsg = new Message({
        sender: socket.user.username, // always from authenticated user
        message: msg.message,
      });
      await newMsg.save();

      io.emit("newMessage", newMsg); // broadcast to all
    } catch (e) {
      console.error("sendMessage error:", e.message);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log("🔌 User disconnected", socket.user.username, reason);
  });
});

// --- Start Server ---
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`🚀 Server listening on ${PORT}`));
