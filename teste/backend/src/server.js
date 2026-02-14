const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const rooms = {};

io.on("connection", (socket) => {
  console.log("Usuário conectado:", socket.id);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        videoId: null,
        isPlaying: false,
        currentTime: 0,
      };
    }

    socket.emit("sync-state", rooms[roomId]);
  });

  socket.on("chat-message", ({ roomId, msg }) => {
    socket.to(roomId).emit("chat-message", msg);
  });

  socket.on("open-video", ({ roomId, videoId }) => {
    if (!rooms[roomId]) return;

    rooms[roomId].videoId = videoId;
    rooms[roomId].isPlaying = true;
    rooms[roomId].currentTime = 0;

    socket.to(roomId).emit("open-video", videoId);
  });

  socket.on("video-play", ({ roomId, currentTime }) => {
    if (!rooms[roomId]) return;

    rooms[roomId].isPlaying = true;
    rooms[roomId].currentTime = currentTime;

    socket.to(roomId).emit("video-play", currentTime);
  });

  socket.on("video-pause", ({ roomId, currentTime }) => {
    if (!rooms[roomId]) return;

    rooms[roomId].isPlaying = false;
    rooms[roomId].currentTime = currentTime;

    socket.to(roomId).emit("video-pause", currentTime);
  });

  socket.on("video-time-update", ({ roomId, currentTime }) => {
    if (!rooms[roomId]) return;

    rooms[roomId].currentTime = currentTime;
  });

  socket.on("disconnect", () => {
    console.log("Usuário desconectado:", socket.id);
  });
});

server.listen(3000, () => {
  console.log("🔥 Servidor rodando em http://localhost:3000");
});
