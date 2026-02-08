const socket = io("http://localhost:3000");

socket.on("connect", () => {
  console.log("Conectado ao servidor:", socket.id);
});

const params = new URLSearchParams(window.location.search);
let roomId = params.get("sala");

if (!roomId) {
  roomId = Math.random().toString(36).substring(2, 8);
  window.location.search = `?sala=${roomId}`;
}

socket.on("connect", () => {
  console.log("Conectado:", socket.id);
  socket.emit("join-room", roomId);
});


const input = document.getElementById("chat-dig");
const btnEnviar = document.getElementById("enviar");
const messages = document.getElementById("messages");

const youtubeContainer = document.getElementById("youtube-container");
const youtubeFrame = document.getElementById("youtube-frame");
const closeYT = document.getElementById("close-yt");
const btnYoutube = document.getElementById("btn-youtube");

/* Enviar mensagem */
btnEnviar.addEventListener("click", sendMessage);

input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  addMessage(text, "user");

  socket.emit("chat-message", {
    roomId,
    msg: text,
  });

  checkYouTubeLink(text);
  input.value = "";
}


/* Criar bolha */
function addMessage(text, type) {
  const msg = document.createElement("div");
  msg.classList.add("message", type);
  msg.textContent = text;
  messages.appendChild(msg);
  messages.scrollTop = messages.scrollHeight;
}

/* Detectar link do YouTube */
function checkYouTubeLink(text) {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/;

  const match = text.match(regex);

  if (match) {
    openYouTube(match[1]);
  }
}

/* Abrir YouTube */
function openYouTube(videoId) {
   youtubeContainer.classList.add("active");
  loadPlayer(videoId);

  socket.emit("open-video", {
    roomId,
    videoId,
  });
}

let player;
let apiReady = false;
let pendingVideoId = null;

function onYouTubeIframeAPIReady() {
  apiReady = true;

  if (pendingVideoId) {
    loadPlayer(pendingVideoId);
    pendingVideoId = null;
  }
}


function loadPlayer(videoId) {
  if (!apiReady) {
    pendingVideoId = videoId;
    return;
  }

  if (player) {
    player.loadVideoById(videoId);
    return;
  }

  player = new YT.Player("youtube-frame", {
      width: "100%",
  height: "100%",
    videoId,
    playerVars: {
      autoplay: 1,
      controls: 1,
    },
  });
}



document.getElementById("playVideo").addEventListener("click", () => {
  if (!player) return;
  player.playVideo();
  socket.emit("video-play", roomId);
});

document.getElementById("pauseVideo").addEventListener("click", () => {
  if (!player) return;
  player.pauseVideo();
  socket.emit("video-pause", roomId);
});


socket.on("video-play", () => {
  if (player) player.playVideo();
});

socket.on("video-pause", () => {
  if (player) player.pauseVideo();
});



/* Fechar YouTube */
closeYT.addEventListener("click", () => {
    youtubeContainer.classList.remove("active");
  if (player) player.stopVideo();
  
});

/* Abrir YouTube clicando no ícone */
btnYoutube.addEventListener("click", () => {
  youtubeContainer.classList.toggle("active");
});

/* Dark mode (tecla D) */
document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "d") {
    document.body.classList.toggle("dark");
  }
});



socket.on("chat-message", (msg) => {
  addMessage(msg, "bot");
});
socket.on("open-video", (videoId) => {
 youtubeContainer.classList.add("active");
  loadPlayer(videoId);
});

window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
