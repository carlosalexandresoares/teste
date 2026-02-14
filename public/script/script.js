let isSyncing = false;

const socket = io();

const params = new URLSearchParams(window.location.search);
let roomId = params.get("sala");

if (!roomId) {
  roomId = Math.random().toString(36).substring(2, 8);
  window.location.search = `?sala=${roomId}`;
}

socket.on("connect", () => {
  socket.emit("join-room", roomId);
});

/* ELEMENTOS */
const input = document.getElementById("chat-dig");
const btnEnviar = document.getElementById("enviar");
const messages = document.getElementById("messages");

const youtubeContainer = document.getElementById("youtube-container");
const closeYT = document.getElementById("close-yt");
const btnYoutube = document.getElementById("btn-youtube");

const btnPlay = document.getElementById("playVideo");
const btnPause = document.getElementById("pauseVideo");

/* ================= CHAT ================= */

// ✅ click garantido
btnEnviar.addEventListener("click", (e) => {
  e.preventDefault();
  sendMessage();
});

// ✅ enter garantido
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendMessage();
  }
});

function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  // mostra para você
  addMessage(text, "user");

  // envia para sala
  socket.emit("chat-message", { roomId, msg: text });

  // tenta detectar youtube no texto
  checkYouTubeLink(text);

  input.value = "";
}

function addMessage(text, type) {
  const msg = document.createElement("div");
  msg.classList.add("message", type);
  msg.textContent = text;
  messages.appendChild(msg);
  messages.scrollTop = messages.scrollHeight;
}

// recebe msg dos outros
socket.on("chat-message", (msg) => {
  addMessage(msg, "bot");

  // ✅ se o outro mandar link do youtube, abre também
  checkYouTubeLink(msg);
});

/* ================= YOUTUBE (API ROBUSTA) ================= */

let player = null;
let playerReady = false;
let pendingVideoId = null;

function loadYouTubeAPI() {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) return resolve();

    const oldCb = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof oldCb === "function") oldCb();
      resolve();
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
  });
}

async function ensurePlayer() {
  if (player && playerReady) return;

  await loadYouTubeAPI();

  player = new YT.Player("youtube-frame", {
    width: "100%",
    height: "100%",
    playerVars: {
      autoplay: 1,
      controls: 1,
      mute: 1,
      playsinline: 1,
      origin: window.location.origin,
    },
    events: {
      onReady: () => {
        playerReady = true;

        if (pendingVideoId) {
          const v = pendingVideoId;
          pendingVideoId = null;
          loadVideo(v);
        }
      },
      onStateChange: onPlayerStateChange,
      onError: (e) => console.log("Erro YouTube:", e.data),
    },
  });
}

async function loadVideo(videoId) {
  youtubeContainer.classList.add("active");
  await ensurePlayer();

  if (!playerReady) {
    pendingVideoId = videoId;
    return;
  }

  isSyncing = true;

  // carrega e tenta dar play
  player.loadVideoById(videoId);

  setTimeout(() => {
    try {
      player.playVideo();
    } catch {}
    isSyncing = false;
  }, 600);
}

function openYouTube(videoId) {

  socket.emit("open-video", { roomId, videoId });
}

/* ✅ detector que funciona mesmo com texto junto */
function extractYouTubeId(text) {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/;

  const match = text.match(regex);
  return match ? match[1] : null;
}

function checkYouTubeLink(text) {
  const id = extractYouTubeId(text);
  if (id) openYouTube(id);
}

/* PLAYER EVENTS */
function onPlayerStateChange(event) {
  if (!playerReady || !player) return;
  if (isSyncing) return;

  if (event.data === YT.PlayerState.PLAYING) {
    socket.emit("video-play", {
      roomId,
      currentTime: player.getCurrentTime(),
    });
  }

  if (event.data === YT.PlayerState.PAUSED) {
    socket.emit("video-pause", {
      roomId,
      currentTime: player.getCurrentTime(),
    });
  }
}

/* ================= SOCKET VIDEO ================= */

socket.on("open-video", (videoId) => {
  loadVideo(videoId);
});

socket.on("video-play", (time) => {
  if (!playerReady || !player) return;

  isSyncing = true;

  try {
    const diff = Math.abs(player.getCurrentTime() - time);
    if (diff > 1) player.seekTo(time, true);
    player.playVideo();
  } catch {}

  setTimeout(() => (isSyncing = false), 500);
});

socket.on("video-pause", (time) => {
  if (!playerReady || !player) return;

  isSyncing = true;

  try {
    player.seekTo(time, true);
    player.pauseVideo();
  } catch {}

  setTimeout(() => (isSyncing = false), 500);
});

socket.on("sync-state", (state) => {
  if (!state.videoId) return;

  loadVideo(state.videoId);

  const wait = setInterval(() => {
    if (playerReady && player) {
      clearInterval(wait);

      isSyncing = true;

      try {
        player.seekTo(state.currentTime || 0, true);
        if (state.isPlaying) player.playVideo();
        else player.pauseVideo();
      } catch {}

      setTimeout(() => (isSyncing = false), 700);
    }
  }, 200);
});

/* ================= CONTROLES ================= */

btnPlay.addEventListener("click", () => {
  if (!playerReady || !player) return;

  player.unMute();
  player.playVideo();

  socket.emit("video-play", {
    roomId,
    currentTime: player.getCurrentTime(),
  });
});

btnPause.addEventListener("click", () => {
  if (!playerReady || !player) return;

  player.pauseVideo();

  socket.emit("video-pause", {
    roomId,
    currentTime: player.getCurrentTime(),
  });
});

closeYT.addEventListener("click", () => {
  youtubeContainer.classList.remove("active");
  if (playerReady && player) player.stopVideo();
});

btnYoutube.addEventListener("click", () => {
  youtubeContainer.classList.toggle("active");
});
