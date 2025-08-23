require("dotenv").config();
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// Allow your Vercel frontend (dev: allow localhost)
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
        return cb(null, true);
      }
      cb(new Error("Not allowed by CORS"));
    },
    methods: ["GET","POST"]
  }
});

app.use(express.json());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
      return cb(null, true);
    }
    cb(new Error("Not allowed by CORS"));
  }
}));

// --- MongoDB connect ---
const { MONGO_URI } = process.env;
if (!MONGO_URI) {
  console.error("Missing MONGO_URI. Set it in .env or Render env vars.");
  process.exit(1);
}
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

// Routes
app.get("/", (req, res) => res.send("OK"));
app.get("/health", (req, res) => res.json({ ok: true, time: new Date() }));
app.use("/messages", require("./routes/messages"));

// Socket.IO
const Message = require("./models/Message");
io.on("connection", (socket) => {
  console.log("🔌 socket connected", socket.id);

  socket.on("sendMessage", async (payload) => {
    try {
      const { sender, message } = payload || {};
      if (!sender || !message) return;

      const saved = await new Message({ sender, message }).save();
      io.emit("newMessage", saved); // broadcast
    } catch (e) {
      console.error("sendMessage error:", e.message);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log("🔌 socket disconnected", socket.id, reason);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`🚀 Server listening on ${PORT}`));
