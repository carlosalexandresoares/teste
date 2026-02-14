const socket = io("http://localhost:3000");

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
input.addEventListener("keypress", e => {
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

socket.on("chat-message", msg => addMessage(msg, "bot"));

/* ================= YOUTUBE ================= */
  
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
      autoplay: 0,
      controls: 1,
    },
    events: {
      onReady: () => {
        playerReady = true;
        console.log("Player pronto");

        if (pendingVideo) {
          player.loadVideoById(pendingVideo);
          pendingVideo = null;
        }
      },
      onStateChange: onPlayerStateChange,
      onError: (e) => {
        console.log("Erro YouTube:", e.data);
      }
    }
  });
};

function loadVideo(videoId) {
  youtubeContainer.classList.add("active");

  if (!playerReady) {
    pendingVideo = videoId;
    return;
  }

  player.loadVideoById(videoId);
}

function openYouTube(videoId) {
  loadVideo(videoId);

  socket.emit("open-video", {
    roomId,
    videoId
  });
}



function checkYouTubeLink(text) {
  try {
    const url = new URL(text);
    
    if (url.hostname.includes("youtu.be")) {
      openYouTube(url.pathname.replace("/", ""));
      return;
    }

    if (url.hostname.includes("youtube.com")) {
      const videoId = url.searchParams.get("v");
      if (videoId) {
        openYouTube(videoId);
      }
    }
  } catch (err) {
    // não é URL válida
  }
}

/* PLAYER EVENTS */

function onPlayerStateChange(event) {
  if (!playerReady) return;

  if (event.data === YT.PlayerState.PLAYING) {
    socket.emit("video-play", {
      roomId,
      currentTime: player.getCurrentTime()
    });
  }

  if (event.data === YT.PlayerState.PAUSED) {
    socket.emit("video-pause", {
      roomId,
      currentTime: player.getCurrentTime()
    });
  }
}

/* ================= SOCKET VIDEO ================= */

socket.on("open-video", videoId => {
  loadVideo(videoId);
});

socket.on("video-play", time => {
  if (!playerReady) return;

  const diff = Math.abs(player.getCurrentTime() - time);

  if (diff > 1) player.seekTo(time);

  player.playVideo();
});

socket.on("video-pause", time => {
  if (!playerReady) return;

  player.seekTo(time);
  player.pauseVideo();
});

/* ================= SINCRONIZAÇÃO REAL ================= */

socket.on("sync-state", (state) => {
  if (!state.videoId) return;

  loadVideo(state.videoId);

  const wait = setInterval(() => {
    if (playerReady) {
      clearInterval(wait);

      player.seekTo(state.currentTime || 0);

      if (state.isPlaying) {
        player.playVideo();
      } else {
        player.pauseVideo();
      }
    }
  }, 200);
});

/* ================= CONTROLES ================= */

document.getElementById("playVideo").addEventListener("click", () => {
  if (!playerReady) return;

  player.playVideo();

  socket.emit("video-play", {
    roomId,
    currentTime: player.getCurrentTime()
  });
});

document.getElementById("pauseVideo").addEventListener("click", () => {
  if (!playerReady) return;

  player.pauseVideo();

  socket.emit("video-pause", {
    roomId,
    currentTime: player.getCurrentTime()
  });
});

closeYT.addEventListener("click", () => {
  youtubeContainer.classList.remove("active");
  if (playerReady) player.stopVideo();
});

btnYoutube.addEventListener("click", () => {
  youtubeContainer.classList.toggle("active");
});

document.addEventListener("keydown", e => {
  if (e.key.toLowerCase() === "d") {
    document.body.classList.toggle("dark");
  }
});
