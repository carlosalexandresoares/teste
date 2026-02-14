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

// recebe msg dos outros
socket.on("chat-message", (msg) => addMessage(msg, "bot"));

/* ================= YOUTUBE ================= */

let player = null;
let playerReady = false;
let pendingVideo = null;

/* API READY */
window.onYouTubeIframeAPIReady = () => {
  player = new YT.Player("youtube-frame", {
    width: "100%",
    height: "100%",
    playerVars: {
      autoplay: 1,
      controls: 1,
      mute: 1, // 🔥 permite autoplay
    },
    events: {
      onReady: () => {
        playerReady = true;

        if (pendingVideo) {
          player.loadVideoById(pendingVideo);
          pendingVideo = null;

          setTimeout(() => {
            if (player) player.playVideo();
          }, 500);
        }
      },
      onStateChange: onPlayerStateChange,
      onError: (e) => console.log("Erro YouTube:", e.data),
    },
  });
};

function loadVideo(videoId) {
  youtubeContainer.classList.add("active");

  if (!playerReady) {
    pendingVideo = videoId;
    return;
  }

  player.loadVideoById(videoId);

  setTimeout(() => {
    if (player) player.playVideo();
  }, 500);
}

function openYouTube(videoId) {
  loadVideo(videoId);

  socket.emit("open-video", {
    roomId,
    videoId,
  });
}

/* Pegar ID do YouTube (aceita links com &t=, &list= etc) */
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

/* PLAYER EVENTS */
function onPlayerStateChange(event) {
  if (!playerReady) return;
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

// 🔥 ESSENCIAL: receber o vídeo e carregar
socket.on("open-video", (videoId) => {
  isSyncing = true;
  loadVideo(videoId);

  setTimeout(() => {
    isSyncing = false;
  }, 800);
});

socket.on("video-play", (time) => {
  if (!playerReady) return;
  if (player.getPlayerState && player.getPlayerState() === -1) return;

  isSyncing = true;

  const diff = Math.abs(player.getCurrentTime() - time);
  if (diff > 1) player.seekTo(time, true);

  player.playVideo();

  setTimeout(() => {
    isSyncing = false;
  }, 500);
});

socket.on("video-pause", (time) => {
  if (!playerReady) return;
  if (player.getPlayerState && player.getPlayerState() === -1) return;

  isSyncing = true;

  player.seekTo(time, true);
  player.pauseVideo();

  setTimeout(() => {
    isSyncing = false;
  }, 500);
});

/* ================= SINCRONIZAÇÃO (ENTRAR/ATUALIZAR) ================= */

socket.on("sync-state", (state) => {
  if (!state.videoId) return;

  loadVideo(state.videoId);

  const wait = setInterval(() => {
    if (playerReady) {
      clearInterval(wait);

      isSyncing = true;

      player.seekTo(state.currentTime || 0, true);

      if (state.isPlaying) player.playVideo();
      else player.pauseVideo();

      setTimeout(() => {
        isSyncing = false;
      }, 700);
    }
  }, 200);
});

/* ================= CONTROLES ================= */

document.getElementById("playVideo").addEventListener("click", () => {
  if (!playerReady) return;

  player.playVideo();

  socket.emit("video-play", {
    roomId,
    currentTime: player.getCurrentTime(),
  });
});

document.getElementById("pauseVideo").addEventListener("click", () => {
  if (!playerReady) return;

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
