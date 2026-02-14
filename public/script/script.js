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

btnEnviar.addEventListener("click", sendMessage);
input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  addMessage(text, "user");
  socket.emit("chat-message", { roomId, msg: text });

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

socket.on("chat-message", (msg) => addMessage(msg, "bot"));

/* ================= YOUTUBE (API SAFE) ================= */

let player = null;
let playerReady = false;
let pendingVideoId = null;

function loadYouTubeAPI() {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) return resolve();

    // cria callback seguro
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previous === "function") previous();
      resolve();
    };

    // injeta script uma vez
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
  });
}

async function ensurePlayer() {
  if (playerReady && player) return;

  await loadYouTubeAPI();

  player = new YT.Player("youtube-frame", {
    width: "100%",
    height: "100%",
    playerVars: {
      autoplay: 1,
      controls: 1,
      mute: 1,          // ✅ autoplay permitido
      playsinline: 1,
      origin: window.location.origin, // ✅ ajuda em produção
    },
    events: {
      onReady: () => {
        playerReady = true;

        // se tinha vídeo pendente, carrega agora
        if (pendingVideoId) {
          player.loadVideoById(pendingVideoId);
          pendingVideoId = null;

          setTimeout(() => {
            if (player) player.playVideo();
          }, 400);
        }
      },
      onStateChange: onPlayerStateChange,
      onError: (e) => {
        console.log("Erro YouTube:", e.data);
      },
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

  player.loadVideoById(videoId);

  setTimeout(() => {
    if (player) player.playVideo();
  }, 400);
}

function openYouTube(videoId) {
  loadVideo(videoId);

  socket.emit("open-video", {
    roomId,
    videoId,
  });
}

/* Pega ID do YouTube (funciona com &t=, playlist etc) */
function checkYouTubeLink(text) {
  try {
    const url = new URL(text);

    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.replace("/", "").split("?")[0];
      if (id) openYouTube(id);
      return;
    }

    if (url.hostname.includes("youtube.com")) {
      const videoId = url.searchParams.get("v");
      if (videoId) openYouTube(videoId);
    }
  } catch {
    // não é URL válida
  }
}

/* PLAYER EVENTS (bloqueia loop) */
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

socket.on("open-video", async (videoId) => {
  isSyncing = true;
  await loadVideo(videoId);
  setTimeout(() => (isSyncing = false), 800);
});

socket.on("video-play", (time) => {
  if (!playerReady || !player) return;

  isSyncing = true;

  const diff = Math.abs(player.getCurrentTime() - time);
  if (diff > 1) player.seekTo(time, true);

  player.playVideo();
  setTimeout(() => (isSyncing = false), 500);
});

socket.on("video-pause", (time) => {
  if (!playerReady || !player) return;

  isSyncing = true;

  player.seekTo(time, true);
  player.pauseVideo();
  setTimeout(() => (isSyncing = false), 500);
});

socket.on("sync-state", async (state) => {
  if (!state.videoId) return;

  await loadVideo(state.videoId);

  const wait = setInterval(() => {
    if (playerReady && player) {
      clearInterval(wait);

      isSyncing = true;

      player.seekTo(state.currentTime || 0, true);

      if (state.isPlaying) player.playVideo();
      else player.pauseVideo();

      setTimeout(() => (isSyncing = false), 700);
    }
  }, 200);
});

/* ================= CONTROLES ================= */

btnPlay.addEventListener("click", () => {
  if (!playerReady || !player) return;

  player.unMute(); // ✅ se o usuário clicou, podemos tirar mute
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

/* Dark mode */
document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "d") {
    document.body.classList.toggle("dark");
  }
});
