const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect('mongodb+srv://chatadmin:andashami928@chatapp.r1hsb71.mongodb.net/?retryWrites=true&w=majority&appName=chatapp', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error(err));

// Message Schema
const MessageSchema = new mongoose.Schema({
  from: String,
  to: String,
  message: String,
  timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

// API Route to get messages
app.get('/messages', async (req, res) => {
  const msgs = await Message.find().sort({ timestamp: 1 });
  res.json(msgs);
});

// Server & Socket.IO Setup
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Socket.IO Events
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('send_message', async (data) => {
    const newMessage = new Message(data);
    await newMessage.save();
    io.emit('receive_message', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(3000, () => console.log('Backend server running on port 3000'));
