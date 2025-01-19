/************************************
 * LocalStorage Keys
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
let currentIndex = 0;  // Current playlist index
let videos = [];
let isLooping = false;
let isFading = false;
let fadeInterval;

let player; // YT Player instance

/************************************
 * 1) Google API script calls initGoogleAPI() AFTER
 *    api.js is loaded. => gapi is defined by then.
 ************************************/
window.initGoogleAPI = function initGoogleAPI() {
  console.log("initGoogleAPI: gapi should be available now!");
  // Now we can safely load the user data and UI
  loadUserData();
  // Wait for the DOM to be ready to bind UI elements
  document.addEventListener("DOMContentLoaded", () => {
    initUI(); 
    initWidget();
  });
};

/************************************
 * 2) onYouTubeIframeAPIReady() => create YT player
 ************************************/
window.onYouTubeIframeAPIReady = function onYouTubeIframeAPIReady() {
  console.log("onYouTubeIframeAPIReady => creating YT player");
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
 * Load & Save in localStorage
 ************************************/
function loadUserData() {
  const rawData = localStorage.getItem(STORAGE_KEY);
  if (rawData) {
    try {
      userData = JSON.parse(rawData);
    } catch (e) {
      console.error("Failed to parse local storage data:", e);
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
  const manageApiButton = document.getElementById("manage-api-button");
  const apiKeyInput = document.getElementById("apiKeyInput");
  const playlistInput = document.getElementById("playlistInput");
  const addPlaylistBtn = document.getElementById("addPlaylistBtn");
  const playlistsList = document.getElementById("playlistsList");
  const saveChangesBtn = document.getElementById("saveChangesBtn");

  // If no API key, show modal right away
  if (!userData.apiKey) {
    manageModal.style.display = "flex";
  }

  manageApiButton.addEventListener("click", () => {
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
 * initWidget => sets up the gapi client 
 * with the user's API key, fetches playlist
 ************************************/
function initWidget() {
  console.log("initWidget => using userData:", userData);
  if (!userData.apiKey) {
    console.warn("No API key found; not calling gapi client.");
    return;
  }

  gapi.client
    .init({ apiKey: userData.apiKey })
    .then(() => {
      if (!userData.playlists.length) {
        console.warn("No playlists in userData.");
        return;
      }
      fetchPlaylistVideos(userData.playlists[currentIndex]);
    })
    .catch((err) => {
      console.error("Failed to init gapi client:", err);
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
 * fetchPlaylistVideos => uses gapi to get videos
 ************************************/
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
      if (videos.length) {
        const first = videos[0];
        const vid = first.snippet.resourceId.videoId;
        const title = first.snippet.title;
        const thumbnail = (first.snippet.thumbnails?.medium || {}).url || "";
        playVideo(vid, title, thumbnail);
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
 * onPlayerStateChange => handle loop & progress
 ************************************/
function onPlayerStateChange(e) {
  if (!player) return;
  // Update total duration
  const totalDurationEl = document.getElementById("total-duration");
  if (totalDurationEl) {
    const d = player.getDuration() || 0;
    const mins = Math.floor(d / 60);
    const secs = Math.floor(d % 60).toString().padStart(2, "0");
    totalDurationEl.textContent = `${mins}:${secs}`;
  }

  // If loop ON and track ended => replay
  if (e.data === YT.PlayerState.ENDED && isLooping) {
    player.setVolume(0);
    player.playVideo();
    fadeVolume(100, 1000);
  }

  // Continuously update progress
  if (e.data === YT.PlayerState.PLAYING) {
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

      // Fill from 0% -> progressPercent with dark green
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

/************************************
 * playVideo => updates header & loads video in YT player
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

  // Re-bind the controls
  initUIControls();

  if (player && typeof player.loadVideoById === "function") {
    player.setVolume(100);
    player.loadVideoById(videoId);
  }
}

function initUIControls() {
  // Manage Data
  const manageBtn = document.getElementById("manage-api-button");
  manageBtn.addEventListener("click", () => {
    document.getElementById("apiKeyInput").value = userData.apiKey || "";
    renderPlaylistsInModal();
    document.getElementById("manage-modal").style.display = "flex";
  });

  // Loop, Shuffle, Prev, Next, etc.
  const loopBtn = document.getElementById("loop-button");
  const shuffleBtn = document.getElementById("shuffle-button");
  const prevBtn = document.getElementById("prev-button");
  const playPauseBtn = document.getElementById("play-pause-button");
  const nextBtn = document.getElementById("next-button");
  const progressBar = document.getElementById("progress-bar");

  loopBtn.addEventListener("click", toggleLoop);
  shuffleBtn.addEventListener("click", shufflePlaylist);
  prevBtn.addEventListener("click", playPreviousSong);
  playPauseBtn.addEventListener("click", togglePlayPause);
  nextBtn.addEventListener("click", playNextSong);

  progressBar.addEventListener("input", seekVideo);
  progressBar.addEventListener("mousemove", showSliderTooltip);
  progressBar.addEventListener("mouseleave", hideSliderTooltip);
}

/* re-render the playlists in the modal (like manage playlists) */
function renderPlaylistsInModal() {
  const ul = document.getElementById("playlistsList");
  ul.innerHTML = "";
  userData.playlists.forEach((pl, i) => {
    const li = document.createElement("li");
    li.textContent = `(${i}) ${pl}`;
    ul.appendChild(li);
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
  const vid = videos[currentIndex]?.snippet?.resourceId?.videoId;
  const title = videos[currentIndex]?.snippet?.title;
  const thumb = (videos[currentIndex]?.snippet?.thumbnails?.medium || {}).url || "";
  if (vid) playVideo(vid, title, thumb);
}

function playPreviousSong() {
  currentIndex = (currentIndex - 1 + videos.length) % videos.length;
  const vid = videos[currentIndex]?.snippet?.resourceId?.videoId;
  const title = videos[currentIndex]?.snippet?.title;
  const thumb = (videos[currentIndex]?.snippet?.thumbnails?.medium || {}).url || "";
  if (vid) playVideo(vid, title, thumb);
}

/************************************
 * Fade Volume
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

    // If we reached/passed targetVolume
    if (
      (volumeStep > 0 && currentVolume >= targetVolume) ||
      (volumeStep < 0 && currentVolume <= targetVolume)
    ) {
      clearInterval(fadeInterval);
      isFading = false;
      player.setVolume(targetVolume);
      if (targetVolume === 0) {
        // fade-out done
        player.pauseVideo();
      } else if (targetVolume === 100) {
        // fade-in done
        player.playVideo();
      }
    }
  }, stepTime);
}

/************************************
 * Toggle Play/Pause with fade
 ************************************/
function togglePlayPause() {
  if (!player) return;
  const playPauseBtn = document.getElementById("play-pause-button");
  const state = player.getPlayerState();

  if (state === YT.PlayerState.PLAYING && !isFading) {
    fadeVolume(0, 1000);
    playPauseBtn.textContent = "▷";
  } else if (
    (state === YT.PlayerState.PAUSED || state === YT.PlayerState.ENDED) &&
    !isFading
  ) {
    player.setVolume(0);
    player.playVideo();
    fadeVolume(100, 1000);
    playPauseBtn.textContent = "| |";
  }
}

/************************************
 * Seek & Tooltip
 ************************************/
function seekVideo() {
  const progressBar = document.getElementById("progress-bar");
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
