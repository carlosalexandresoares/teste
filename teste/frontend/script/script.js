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

socket.emit("join-room", roomId);


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
  youtubeFrame.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
  youtubeContainer.classList.add("active");
}

/* Fechar YouTube */
closeYT.addEventListener("click", () => {
  youtubeContainer.classList.remove("active");
  youtubeFrame.src = "";
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
