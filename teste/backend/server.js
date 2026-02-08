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

io.on("connection", (socket) => {
  console.log("Usuário conectado:", socket.id);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    console.log(`Usuário ${socket.id} entrou na sala ${roomId}`);
  });

  socket.on("chat-message", ({ roomId, msg }) => {
    socket.to(roomId).emit("chat-message", msg);
  });

  socket.on("open-video", ({ roomId, videoId }) => {
    socket.to(roomId).emit("open-video", videoId);
  });

  socket.on("disconnect", () => {
    console.log("Usuário desconectado:", socket.id);
  });
});


server.listen(3000, () => {
  console.log("🔥 Servidor rodando em http://localhost:3000");
});
