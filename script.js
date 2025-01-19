/************************************
 * Storage Keys
 ************************************/
const STORAGE_KEY = "youtubeWidgetData"; 
/* We'll store an object { apiKey: string, playlists: string[] } in localStorage. */

let userData = {
  apiKey: "",
  playlists: [],
};
let currentIndex = 0;         // Which playlist we're using
let isLooping = false;
let isFading = false;
let fadeInterval;
let player;

/************************************
 * onload=initGoogleAPI calls this 
 * AFTER gapi is defined.
 ************************************/
function loadYouTubeAPI() {
  console.log("loadYouTubeAPI called - gapi is now defined.");
  loadUserData();       // localStorage retrieval
  initUI();             // manage modal UI
  initWidget();         // build the widget
}

/************************************
 * Load & Save Data to localStorage
 ************************************/
function loadUserData() {
  const rawData = localStorage.getItem(STORAGE_KEY);
  if (rawData) {
    try {
      userData = JSON.parse(rawData);
    } catch (e) {
      console.error("Failed to parse local storage data", e);
    }
  }
}

function saveUserData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
}

/************************************
 * UI for Manage button & modal
 ************************************/
function initUI() {
  const manageBtn = document.getElementById("manage-api-button");
  const manageModal = document.getElementById("manage-modal");
  const apiKeyInput = document.getElementById("apiKeyInput");
  const playlistInput = document.getElementById("playlistInput");
  const addPlaylistBtn = document.getElementById("addPlaylistBtn");
  const playlistsList = document.getElementById("playlistsList");
  const saveChangesBtn = document.getElementById("saveChangesBtn");

  // Open modal if no API key yet
  if (!userData.apiKey) {
    manageModal.style.display = "flex";
  }

  manageBtn.addEventListener("click", () => {
    apiKeyInput.value = userData.apiKey || "";
    renderPlaylistsList();
    manageModal.style.display = "flex";
  });

  function renderPlaylistsList() {
    playlistsList.innerHTML = "";
    userData.playlists.forEach((pl, i) => {
      const li = document.createElement("li");
      li.textContent = `(${i}) ${pl}`;
      playlistsList.appendChild(li);
    });
  }

  addPlaylistBtn.addEventListener("click", () => {
    const newPl = playlistInput.value.trim();
    if (!newPl) return;
    userData.playlists.push(newPl);
    playlistInput.value = "";
    renderPlaylistsList();
  });

  saveChangesBtn.addEventListener("click", () => {
    userData.apiKey = apiKeyInput.value.trim();
    saveUserData();
    manageModal.style.display = "none";
    reloadWidget();
  });
}

/************************************
 * initWidget: Setup or re-setup
 * the YouTube Data API calls
 ************************************/
function initWidget() {
  console.log("INIT WIDGET with key:", userData.apiKey);

  if (!userData.apiKey) {
    console.warn("No API key provided. Widget won't fetch data.");
    return;
  }

  // Load gapi client with the user's key
  gapi.client
    .init({ apiKey: userData.apiKey })
    .then(() => {
      // If no playlists stored, do nothing
      if (userData.playlists.length === 0) return;

      // Attempt to fetch the first playlist
      fetchPlaylistVideos(userData.playlists[currentIndex]);
    })
    .catch((err) => {
      console.error("Failed to init gapi client:", err);
    });
}

/************************************
 * Reload widget after user changes data
 ************************************/
function reloadWidget() {
  console.log("Reloading widget with new data...");
  // Reset the player? Optionally tear down old references
  initWidget();
}

/************************************
 * fetchPlaylistVideos using gapi
 ************************************/
let videos = [];

function fetchPlaylistVideos(playlistId) {
  gapi.client
    .request({
      path: "https://www.googleapis.com/youtube/v3/playlistItems",
      params: {
        part: "snippet",
        maxResults: 50,
        playlistId: playlistId,
      },
    })
    .then((res) => {
      videos = res.result.items || [];
      currentIndex = 0;
      displayPlaylist(videos);
      if (videos.length > 0) {
        const first = videos[0];
        const vid = first.snippet.resourceId.videoId;
        const title = first.snippet.title;
        const thumbnail =
          (first.snippet.thumbnails && first.snippet.thumbnails.medium) ? first.snippet.thumbnails.medium.url : "";
        playVideo(vid, title, thumbnail);
      }
    })
    .catch((err) => {
      console.error("Playlist fetch error:", err);
    });
}

/************************************
 * displayPlaylist in #playlist
 ************************************/
function displayPlaylist(videoList) {
  const playlistContainer = document.getElementById("playlist");
  playlistContainer.innerHTML = "";

  videoList.forEach((video, i) => {
    const videoId = video.snippet.resourceId.videoId;
    const title = video.snippet.title;
    const thumbnail =
      (video.snippet.thumbnails && video.snippet.thumbnails.medium)
        ? video.snippet.thumbnails.medium.url
        : "";

    const trackElement = document.createElement("div");
    trackElement.className = "track";
    trackElement.innerHTML = `
      <img src="${thumbnail}" alt="${title}" />
      <p>${title}</p>
    `;

    trackElement.addEventListener("click", () => {
      currentIndex = i;
      playVideo(videoId, title, thumbnail);
    });

    playlistContainer.appendChild(trackElement);
  });
}

/************************************
 * Initialize the YouTube IFrame Player
 ************************************/
function onYouTubeIframeAPIReady() {
  console.log("IFrame API ready - creating player");
  player = new YT.Player("player", {
    height: "0",
    width: "0",
    videoId: "",
    playerVars: { controls: 0 },
    events: {
      onReady: () => {
        console.log("YT Player ready");
        player.setVolume(100);
      },
      onStateChange: onPlayerStateChange,
    },
  });
}

/************************************
 * PLAY a selected video
 ************************************/
function playVideo(videoId, title, thumbnail) {
  const nowPlaying = document.getElementById("now-playing");
  nowPlaying.innerHTML = `
    <img src="${thumbnail}" alt="${title}" />
    <div class="center-info">
      <p class="now-playing-text">
        Playing Now • <span id="total-duration">0:00</span>
      </p>
      <p class="song-title">${title}</p>
    </div>
    <div class="controls">
      <button id="manage-api-button">Manage Data</button>
      <button id="loop-button" title="Loop (Off)">↻</button>
      <button id="shuffle-button" title="Shuffle">⇄</button>
      <button id="prev-button" title="Previous Song">|≪</button>
      <button id="play-pause-button" title="Play/Pause">▷</button>
      <button id="next-button" title="Next Song">≫|</button>
    </div>
    <input type="range" id="progress-bar" value="0" min="0" max="100" />
    <div id="slider-tooltip">0:00</div>
  `;

  // Re-init UI for manage modal
  initUIControls();

  // If player is ready, load the new video
  if (player && typeof player.loadVideoById === "function") {
    player.setVolume(100);
    player.loadVideoById(videoId);
  }
}

function initUIControls() {
  // Re-bind controls
  const manageBtn = document.getElementById("manage-api-button");
  const loopBtn = document.getElementById("loop-button");
  const shuffleBtn = document.getElementById("shuffle-button");
  const prevBtn = document.getElementById("prev-button");
  const playPauseBtn = document.getElementById("play-pause-button");
  const nextBtn = document.getElementById("next-button");

  manageBtn.addEventListener("click", () => {
    const modal = document.getElementById("manage-modal");
    modal.style.display = "flex";
    // Populate fields, etc. from userData
    document.getElementById("apiKeyInput").value = userData.apiKey || "";
    renderPlaylistListInModal();
  });

  loopBtn.addEventListener("click", toggleLoop);
  shuffleBtn.addEventListener("click", shufflePlaylist);
  prevBtn.addEventListener("click", playPreviousSong);
  playPauseBtn.addEventListener("click", togglePlayPause);
  nextBtn.addEventListener("click", playNextSong);

  const progressBar = document.getElementById("progress-bar");
  progressBar.addEventListener("input", seekVideo);
  progressBar.addEventListener("mousemove", showSliderTooltip);
  progressBar.addEventListener("mouseleave", hideSliderTooltip);
}

function renderPlaylistListInModal() {
  const playlistsList = document.getElementById("playlistsList");
  playlistsList.innerHTML = "";
  userData.playlists.forEach((pl, i) => {
    const li = document.createElement("li");
    li.textContent = `(${i}) ${pl}`;
    playlistsList.appendChild(li);
  });
}

/************************************
 * LOOP, SHUFFLE, PLAY/PAUSE, etc.
 ************************************/
function toggleLoop() {
  isLooping = !isLooping;
  this.title = isLooping ? "Loop (On)" : "Loop (Off)";
  this.style.opacity = isLooping ? "0.7" : "1.0";
}

function shufflePlaylist() {
  for (let i = videos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [videos[i], videos[j]] = [videos[j], videos[i]];
  }
  displayPlaylist(videos);
}

function togglePlayPause() {
  if (!player) return;
  const playPauseBtn = document.getElementById("play-pause-button");
  const state = player.getPlayerState();

  if (state === YT.PlayerState.PLAYING && !isFading) {
    fadeVolume(0, 1000);
    playPauseBtn.textContent = "▷";
  } else if ((state === YT.PlayerState.PAUSED || state === YT.PlayerState.ENDED) && !isFading) {
    player.setVolume(0);
    player.playVideo();
    fadeVolume(100, 1000);
    playPauseBtn.textContent = "| |";
  }
}

function playNextSong() {
  currentIndex = (currentIndex + 1) % videos.length;
  const nextVideo = videos[currentIndex];
  if (!nextVideo) return;
  const vid = nextVideo.snippet.resourceId.videoId;
  const title = nextVideo.snippet.title;
  const thumb = (nextVideo.snippet.thumbnails.medium || {}).url || "";
  playVideo(vid, title, thumb);
}

function playPreviousSong() {
  currentIndex = (currentIndex - 1 + videos.length) % videos.length;
  const prevVideo = videos[currentIndex];
  if (!prevVideo) return;
  const vid = prevVideo.snippet.resourceId.videoId;
  const title = prevVideo.snippet.title;
  const thumb = (prevVideo.snippet.thumbnails.medium || {}).url || "";
  playVideo(vid, title, thumb);
}

/************************************
 * Seeking & tooltip
 ************************************/
function seekVideo(event) {
  const progressBar = event.target;
  const duration = player.getDuration() || 0;
  const seekTo = (progressBar.value / 100) * duration;
  player.seekTo(seekTo);
}

function showSliderTooltip(e) {
  const progressBar = e.target;
  const tooltip = document.getElementById("slider-tooltip");
  const rect = progressBar.getBoundingClientRect();
  const xPos = e.clientX - rect.left;

  const fraction = xPos / rect.width;
  const duration = player.getDuration() || 0;
  const hoverTime = fraction * duration;
  const hoverMins = Math.floor(hoverTime / 60);
  const hoverSecs = Math.floor(hoverTime % 60).toString().padStart(2, "0");

  tooltip.textContent = `${hoverMins}:${hoverSecs}`;
  tooltip.style.left = `${xPos}px`;
  tooltip.style.display = "block";
}

function hideSliderTooltip() {
  const tooltip = document.getElementById("slider-tooltip");
  tooltip.style.display = "none";
}

/************************************
 * onPlayerStateChange 
 ************************************/
function onPlayerStateChange(event) {
  // Update total duration
  const totalDurationEl = document.getElementById("total-duration");
  if (totalDurationEl && player) {
    const d = player.getDuration() || 0;
    const mins = Math.floor(d / 60);
    const secs = Math.floor(d % 60).toString().padStart(2, "0");
    totalDurationEl.textContent = `${mins}:${secs}`;
  }

  // If loop ON and track ended => replay
  if (event.data === YT.PlayerState.ENDED && isLooping) {
    player.setVolume(0);
    player.playVideo();
    fadeVolume(100, 1000);
  }

  // Continuously update progress
  if (event.data === YT.PlayerState.PLAYING) {
    const progressBar = document.getElementById("progress-bar");
    const updateInterval = setInterval(() => {
      if (!progressBar || player.getPlayerState() !== YT.PlayerState.PLAYING) {
        clearInterval(updateInterval);
        return;
      }
      const currentTime = player.getCurrentTime() || 0;
      const duration = player.getDuration() || 1;
      const progressPercent = (currentTime / duration) * 100;

      progressBar.value = progressPercent.toString();
      progressBar.style.background = `
        linear-gradient(to right,
          #2D5F55 0%,
          #2D5F55 ${progressPercent}%,
          #202020 ${progressPercent}%,
          #202020 100%)
      `;
    }, 500);
  }
}
