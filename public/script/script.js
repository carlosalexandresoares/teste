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

/* ================= YOUTUBE (ROBUSTO) ================= */

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
      autoplay: 0,
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
          safeLoadAndPlay(v, 0, true);
        }
      },
      onStateChange: onPlayerStateChange,
      onError: (e) => {
        console.log("Erro YouTube:", e.data);

        // 🔥 fallback: recria o player se der erro
        if (pendingVideoId) return;
        // tenta recarregar o mesmo video se existir
        tryRecreatePlayer();
      },
    },
  });
}

function destroyPlayer() {
  try {
    if (player && typeof player.destroy === "function") player.destroy();
  } catch {}
  player = null;
  playerReady = false;
}

async function tryRecreatePlayer() {
  const current = lastVideoId;
  const time = lastKnownTime || 0;

  destroyPlayer();
  await ensurePlayer();

  if (current) safeLoadAndPlay(current, time, false);
}

let lastVideoId = null;
let lastKnownTime = 0;

async function safeLoadAndPlay(videoId, time = 0, forcePlay = true) {
  youtubeContainer.classList.add("active");

  await ensurePlayer();

  lastVideoId = videoId;

  // ainda não pronto? guarda
  if (!playerReady) {
    pendingVideoId = videoId;
    return;
  }

  isSyncing = true;

  // ✅ carrega sem forçar play instantâneo (evita erro)
  player.loadVideoById(videoId, time);

  // espera o player “acordar”
  const start = Date.now();
  const timer = setInterval(() => {
    if (!player) return;

    const state = player.getPlayerState?.();

    // se já saiu do -1, podemos agir
    if (state !== -1) {
      clearInterval(timer);

      // aplica seek e play com calma
      try {
        if (time > 0) player.seekTo(time, true);
        if (forcePlay) player.playVideo();
      } catch {}

      setTimeout(() => {
        isSyncing = false;
      }, 600);
    }

    // timeout de segurança (2.5s)
    if (Date.now() - start > 2500) {
      clearInterval(timer);
      isSyncing = false;
    }
  }, 150);
}

function openYouTube(videoId) {
  // abre local
  safeLoadAndPlay(videoId, 0, true);

  // avisa sala
  socket.emit("open-video", { roomId, videoId });
}

/* PLAYER EVENTS (bloqueia loop) */
function onPlayerStateChange(event) {
  if (!playerReady || !player) return;
  if (isSyncing) return;

  // guarda tempo
  try {
    lastKnownTime = player.getCurrentTime();
  } catch {}

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

// ✅ ESSENCIAL: quando receber open-video, carrega de forma segura
socket.on("open-video", (videoId) => {
  safeLoadAndPlay(videoId, 0, true);
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

/* ================= SYNC-STATE (quando entra/atualiza) ================= */
socket.on("sync-state", (state) => {
  if (!state.videoId) return;

  safeLoadAndPlay(state.videoId, state.currentTime || 0, state.isPlaying);
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
