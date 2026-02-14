  const socket = io("http://localhost:3000");

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

    socket.emit("chat-message", {
      roomId,
      msg: text,
    });

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

  socket.on("chat-message", (msg) => {
    addMessage(msg, "bot");
  });

  /* ================= YOUTUBE ================= */

  let player = null;
  let apiReady = false;
  let pendingVideoId = null;

  /* API pronta */
  function onYouTubeIframeAPIReady() {
    apiReady = true;

    if (pendingVideoId) {
      createOrLoadPlayer(pendingVideoId);
      pendingVideoId = null;
    }
  }

  window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;

  /* Criar ou carregar player */
  function createOrLoadPlayer(videoId) {
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
      events: {
        onStateChange: onPlayerStateChange,
      },
    });
  }

  /* Abrir vídeo */
  function openYouTube(videoId) {
    youtubeContainer.classList.add("active");

    createOrLoadPlayer(videoId);

    socket.emit("open-video", {
      roomId,
      videoId,
    });
  }

  /* Detectar link */
  function checkYouTubeLink(text) {
    const regex =
      /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/;

    const match = text.match(regex);

    if (match) {
      openYouTube(match[1]);
    }
  }

  /* Play / Pause eventos */
  function onPlayerStateChange(event) {
    if (!player) return;

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
    youtubeContainer.classList.add("active");
    createOrLoadPlayer(videoId);
  });

  socket.on("video-play", (time) => {
    if (!player) return;

    const diff = Math.abs(player.getCurrentTime() - time);

    if (diff > 1) {
      player.seekTo(time);
    }

    player.playVideo();
  });

  socket.on("video-pause", (time) => {
    if (!player) return;

    player.seekTo(time);
    player.pauseVideo();
  });

  /* Sincronização periódica */
  setInterval(() => {
    if (player && player.getPlayerState() === 1) {
      socket.emit("video-time-update", {
        roomId,
        currentTime: player.getCurrentTime(),
      });
    }
  }, 2000);

  /* Estado da sala */
  socket.on("sync-state", (state) => {
    if (!state.videoId) return;

    youtubeContainer.classList.add("active");

    createOrLoadPlayer(state.videoId);

    setTimeout(() => {
      if (!player) return;

      player.seekTo(state.currentTime);

      if (state.isPlaying) {
        player.playVideo();
      } else {
        player.pauseVideo();
      }
    }, 1500);
  });

  /* ================= CONTROLES ================= */

  document.getElementById("playVideo").addEventListener("click", () => {
    if (!player) return;

    const time = player.getCurrentTime();

    player.playVideo();

    socket.emit("video-play", {
      roomId,
      currentTime: time,
    });
  });

  document.getElementById("pauseVideo").addEventListener("click", () => {
    if (!player) return;

    player.pauseVideo();

    socket.emit("video-pause", {
      roomId,
      currentTime: player.getCurrentTime(),
    });
  });

  /* Fechar */
  closeYT.addEventListener("click", () => {
    youtubeContainer.classList.remove("active");
    if (player) player.stopVideo();
  });

  /* Toggle botão YouTube */
  btnYoutube.addEventListener("click", () => {
    youtubeContainer.classList.toggle("active");
  });

  /* Dark mode */
  document.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "d") {
      document.body.classList.toggle("dark");
    }
  });
