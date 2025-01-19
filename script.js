/************************************
 * LocalStorage Key
 ************************************/
const STORAGE_KEY = "youtubeWidgetData"; 
/*
We'll store an object { apiKey: string, playlists: string[] }
in localStorage.
*/

let userData = {
  apiKey: "",
  playlists: [],
};

let currentIndex = 0;
let videos = [];
let isLooping = false;
let isFading = false;
let fadeInterval;
let player;

/************************************
 * initGoogleAPI() => Called by ?onload=initGoogleAPI 
 * from api.js AFTER gapi is loaded
 ************************************/
window.initGoogleAPI = function initGoogleAPI() {
  console.log("initGoogleAPI => gapi is defined, now we load user data & UI");
  loadUserData();

  // Wait until DOM is ready to bind UI
  document.addEventListener("DOMContentLoaded", () => {
    initUI();
    // We won't create the player here; that's done by onYouTubeIframeAPIReady
    // But we can load the user's data & attempt to fetch playlists
    console.log("DOM loaded => initWidget()");
    initWidget();
  });
};

/************************************
 * onYouTubeIframeAPIReady => 
 * Called by the YT script once it's ready
 ************************************/
window.onYouTubeIframeAPIReady = function onYouTubeIframeAPIReady() {
  console.log("onYouTubeIframeAPIReady => Creating YT player");
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
};

/************************************
 * Load & Save localStorage
 ************************************/
function loadUserData() {
  const rawData = localStorage.getItem(STORAGE_KEY);
  if (rawData) {
    try {
      userData = JSON.parse(rawData);
    } catch (err) {
      console.error("Failed to parse local storage data:", err);
    }
  }
}

function saveUserData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
}

/************************************
 * UI for manage modal
 ************************************/
function initUI() {
  const manageModal = document.getElementById("manage-modal");
  const manageApiBtn = document.getElementById("manage-api-button");

  const apiKeyInput = document.getElementById("apiKeyInput");
  const playlistInput = document.getElementById("playlistInput");
  const addPlaylistBtn = document.getElementById("addPlaylistBtn");
  const playlistsList = document.getElementById("playlistsList");
  const saveChangesBtn = document.getElementById("saveChangesBtn");

  // If no API key, show modal right away
  if (!userData.apiKey) {
    manageModal.style.display = "flex";
  }

  manageApiBtn.addEventListener("click", () => {
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
 * initWidget => 
 * 1) load "client" library
 * 2) gapi.client.init({ apiKey })
 * 3) fetchPlaylistVideos
 ************************************/
function initWidget() {
  if (!userData.apiKey) {
    console.warn("No API key => not calling gapi yet.");
    return;
  }

  console.log("initWidget => calling gapi.load('client')...");
  gapi.load("client", () => {
    console.log("gapi.load('client') => client library loaded");
    gapi.client
      .init({ apiKey: userData.apiKey })
      .then(() => {
        console.log("gapi.client.init => success");
        if (!userData.playlists.length) {
          console.warn("No playlists in userData.");
          return;
        }
        fetchPlaylistVideos(userData.playlists[currentIndex]);
      })
      .catch((err) => {
        console.error("Failed to init gapi client:", err);
      });
  });
}

/************************************
 * reloadWidget => re-run initWidget
 * after user changes data
 ************************************/
function reloadWidget() {
  console.log("reloadWidget => re-initialize with new data");
  initWidget();
}

/************************************
 * fetchPlaylistVideos => uses gapi client
 ************************************/
function fetchPlaylistVideos(playlistId) {
  console.log("fetchPlaylistVideos => ID:", playlistId);
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

      if (videos.length) {
        const first = videos[0];
        const vid = first.snippet.resourceId.videoId;
        const t = first.snippet.title;
        const thumb =
          (first.snippet.thumbnails && first.snippet.thumbnails.medium) ? first.snippet.thumbnails.medium.url : "";
        playVideo(vid, t, thumb);
      }
    })
    .catch((err) => {
      console.error("Playlist fetch error:", err);
    });
}

/************************************
 * displayPlaylist => fill #playlist
 ************************************/
function displayPlaylist(videoList) {
  const playlistDiv = document.getElementById("playlist");
  playlistDiv.innerHTML = "";
  videoList.forEach((v, i) => {
    const videoId = v.snippet.resourceId.videoId;
    const title = v.snippet.title;
    const thumb = (v.snippet.thumbnails?.medium || {}).url || "";

    const trackEl = document.createElement("div");
    trackEl.className = "track";
    trackEl.innerHTML = `
      <img src="${thumb}" alt="${title}" />
      <p>${title}</p>
    `;
    trackEl.addEventListener("click", () => {
      currentIndex = i;
      playVideo(videoId, title, thumb);
    });
    playlistDiv.appendChild(trackEl);
  });
}

/************************************
 * onYouTubeIframeAPIReady => triggers 
 * YT Player creation (set above)
 ************************************/
function onPlayerStateChange(e) {
  // Duration in "Playing Now"
  const totalDurationEl = document.getElementById("total-duration");
  if (totalDurationEl && player) {
    const d = player.getDuration() || 0;
    const mins = Math.floor(d / 60);
    const secs = Math.floor(d % 60).toString().padStart(2, "0");
    totalDurationEl.textContent = `${mins}:${secs}`;
  }

  // If loop ON and ended => fade in & replay
  if (e.data === YT.PlayerState.ENDED && isLooping) {
    player.setVolume(0);
    player.playVideo();
    fadeVolume(100, 1000);
  }

  // Continuously update progress
  if (e.data === YT.PlayerState.PLAYING) {
    const progressBar = document.getElementById("progress-bar");
    const interval = setInterval(() => {
      if (!progressBar || player.getPlayerState() !== YT.PlayerState.PLAYING) {
        clearInterval(interval);
        return;
      }
      const ct = player.getCurrentTime() || 0;
      const dur = player.getDuration() || 1;
      const percent = (ct / dur) * 100;

      progressBar.value = percent.toString();
      progressBar.style.background = `
        linear-gradient(to right,
          #2D5F55 0%,
          #2D5F55 ${percent}%,
          #202020 ${percent}%,
          #202020 100%)
      `;
    }, 500);
  }
}

/************************************
 * playVideo => updates header & loads
 * new video
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

  initUIControls(); // re-bind control events

  if (player && typeof player.loadVideoById === "function") {
    player.setVolume(100);
    player.loadVideoById(videoId);
  }
}

/************************************
 * Re-bind the control events 
 * after refreshing the header
 ************************************/
function initUIControls() {
  const manageBtn = document.getElementById("manage-api-button");
  const loopBtn = document.getElementById("loop-button");
  const shuffleBtn = document.getElementById("shuffle-button");
  const prevBtn = document.getElementById("prev-button");
  const playPauseBtn = document.getElementById("play-pause-button");
  const nextBtn = document.getElementById("next-button");
  const progressBar = document.getElementById("progress-bar");

  manageBtn.addEventListener("click", () => {
    document.getElementById("apiKeyInput").value = userData.apiKey || "";
    renderModalPlaylistList();
    document.getElementById("manage-modal").style.display = "flex";
  });

  loopBtn.addEventListener("click", toggleLoop);
  shuffleBtn.addEventListener("click", shufflePlaylist);
  prevBtn.addEventListener("click", playPreviousSong);
  playPauseBtn.addEventListener("click", togglePlayPause);
  nextBtn.addEventListener("click", playNextSong);

  progressBar.addEventListener("input", seekVideo);
  progressBar.addEventListener("mousemove", showSliderTooltip);
  progressBar.addEventListener("mouseleave", hideSliderTooltip);
}

function renderModalPlaylistList() {
  const listEl = document.getElementById("playlistsList");
  listEl.innerHTML = "";
  userData.playlists.forEach((pl, i) => {
    const li = document.createElement("li");
    li.textContent = `(${i}) ${pl}`;
    listEl.appendChild(li);
  });
}

/************************************
 * Loop, Shuffle, Next/Prev
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

function playNextSong() {
  currentIndex = (currentIndex + 1) % videos.length;
  const video = videos[currentIndex];
  if (!video) return;
  const vid = video.snippet.resourceId.videoId;
  const t = video.snippet.title;
  const thumb =
    (video.snippet.thumbnails?.medium || {}).url || "";
  playVideo(vid, t, thumb);
}

function playPreviousSong() {
  currentIndex = (currentIndex - 1 + videos.length) % videos.length;
  const video = videos[currentIndex];
  if (!video) return;
  const vid = video.snippet.resourceId.videoId;
  const t = video.snippet.title;
  const thumb =
    (video.snippet.thumbnails?.medium || {}).url || "";
  playVideo(vid, t, thumb);
}

/************************************
 * fadeVolume => fade in/out
 ************************************/
function fadeVolume(targetVolume, fadeTime = 1000) {
  if (!player) return;
  clearInterval(fadeInterval);
  isFading = true;

  let steps = 20;
  let stepTime = fadeTime / steps;
  let currentVolume = player.getVolume();
  let volumeStep = (targetVolume - currentVolume) / steps;

  fadeInterval = setInterval(() => {
    currentVolume += volumeStep;
    if (currentVolume < 0) currentVolume = 0;
    if (currentVolume > 100) currentVolume = 100;
    player.setVolume(currentVolume);

    if (
      (volumeStep > 0 && currentVolume >= targetVolume) ||
      (volumeStep < 0 && currentVolume <= targetVolume)
    ) {
      clearInterval(fadeInterval);
      isFading = false;
      player.setVolume(targetVolume);
      if (targetVolume === 0) {
        player.pauseVideo();
      } else if (targetVolume === 100) {
        player.playVideo();
      }
    }
  }, stepTime);
}

/************************************
 * togglePlayPause => fade in/out
 ************************************/
function togglePlayPause() {
  if (!player) return;
  const btn = document.getElementById("play-pause-button");
  const state = player.getPlayerState();

  if (state === YT.PlayerState.PLAYING && !isFading) {
    fadeVolume(0, 1000);
    btn.textContent = "▷";
  } else if (
    (state === YT.PlayerState.PAUSED || state === YT.PlayerState.ENDED) &&
    !isFading
  ) {
    player.setVolume(0);
    player.playVideo();
    fadeVolume(100, 1000);
    btn.textContent = "| |";
  }
}

/************************************
 * Seeking & Tooltip
 ************************************/
function seekVideo() {
  if (!player) return;
  const progressBar = document.getElementById("progress-bar");
  const duration = player.getDuration() || 0;
  const seekTo = (progressBar.value / 100) * duration;
  player.seekTo(seekTo);
}

function showSliderTooltip(e) {
  if (!player) return;
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
