/************************************
 * Your YouTube Data API credentials
 ************************************/
const API_KEY = "AIzaSyBQFssUub98c3uM8v9gTCJFdm0yrm3Jf_U"; 
const DEFAULT_PLAYLIST_ID = "PL9d_89eA4IBFlekQwWklMP674h31gIV2U";

let currentPlaylistID = DEFAULT_PLAYLIST_ID;

let player;
let videos = [];
let currentIndex = 0;
let isLooping = false; // For the loop feature
let isFading = false; // Prevent overlapping fade processes
let fadeInterval;      // Used to clear ongoing fade steps

/************************************
 * Fade the volume over fadeTime ms
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

    if ((volumeStep > 0 && currentVolume >= targetVolume) ||
        (volumeStep < 0 && currentVolume <= targetVolume)) {
      clearInterval(fadeInterval);
      isFading = false;
      player.setVolume(targetVolume);

      // If fade-out complete, pause
      if (targetVolume === 0) {
        player.pauseVideo();
      }
      // If fade-in complete, ensure playing
      else if (targetVolume === 100) {
        player.playVideo();
      }
    }
  }, stepTime);
}

/************************************
 * Load the YouTube Data API
 ************************************/
function loadYouTubeAPI() {
  gapi.load("client", () => {
    gapi.client
      .init({
        apiKey: API_KEY,
      })
      .then(() => {
        fetchPlaylistVideos(currentPlaylistID);
      });
  });
}

/************************************
 * Fetch playlist videos
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
    .then((response) => {
      videos = response.result.items || [];
      currentIndex = 0;
      displayPlaylist(videos);
    });
}

/************************************
 * Display playlist in #playlist
 ************************************/
function displayPlaylist(videoList) {
  const playlistContainer = document.getElementById("playlist");
  playlistContainer.innerHTML = "";

  videoList.forEach((video, index) => {
    const videoId = video.snippet.resourceId.videoId;
    const title = video.snippet.title;
    const thumbnail = (video.snippet.thumbnails && video.snippet.thumbnails.medium)
      ? video.snippet.thumbnails.medium.url
      : "";
    
    const trackElement = document.createElement("div");
    trackElement.className = "track";
    trackElement.innerHTML = `
      <img src="${thumbnail}" alt="${title}" />
      <p>${title}</p>
    `;

    trackElement.addEventListener("click", () => {
      currentIndex = index;
      playVideo(videoId, title, thumbnail);
    });

    playlistContainer.appendChild(trackElement);
  });

  if (videoList.length > 0) {
    const first = videoList[0];
    playVideo(
      first.snippet.resourceId.videoId,
      first.snippet.title,
      first.snippet.thumbnails.medium.url
    );
  }
}

/************************************
 * Initialize YouTube IFrame Player
 ************************************/
function initializeYouTubePlayer() {
  player = new YT.Player("player", {
    height: "0",
    width: "0",
    videoId: "",
    playerVars: { controls: 0 },
    events: {
      onReady: () => {
        console.log("Player ready");
        player.setVolume(100);
      },
      onStateChange: onPlayerStateChange,
    },
  });
}

/************************************
 * Play a selected video
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
      <button id="switch-playlist-button" title="Switch Playlist">Switch</button>
      <button id="loop-button" title="Loop (Off)">↻</button>
      <button id="shuffle-button" title="Shuffle">⇄</button>
      <button id="prev-button" title="Previous Song">|≪</button>
      <button id="play-pause-button" title="Play/Pause">▷</button>
      <button id="next-button" title="Next Song">≫|</button>
    </div>
    <input type="range" id="progress-bar" value="0" min="0" max="100" />
    <div id="slider-tooltip">0:00</div>
  `;

  // Bind controls
  document.getElementById("switch-playlist-button").addEventListener("click", switchPlaylist);
  document.getElementById("loop-button").addEventListener("click", toggleLoop);
  document.getElementById("shuffle-button").addEventListener("click", shufflePlaylist);
  document.getElementById("prev-button").addEventListener("click", playPreviousSong);
  document.getElementById("play-pause-button").addEventListener("click", togglePlayPause);
  document.getElementById("next-button").addEventListener("click", playNextSong);

  const progressBar = document.getElementById("progress-bar");
  progressBar.addEventListener("input", seekVideo);
  progressBar.addEventListener("mousemove", showSliderTooltip);
  progressBar.addEventListener("mouseleave", hideSliderTooltip);

  // Load the video
  if (player && typeof player.loadVideoById === "function") {
    player.setVolume(100); 
    player.loadVideoById(videoId);
  }
}

/************************************
 * Switch Playlist (prompt + save)
 ************************************/
function switchPlaylist() {
  const newID = prompt("Enter the new YouTube Playlist ID:", "");
  if (!newID) return;
  currentPlaylistID = newID.trim();
  fetchPlaylistVideos(currentPlaylistID);
}

/************************************
 * Toggle looping
 ************************************/
function toggleLoop() {
  isLooping = !isLooping;
  this.title = isLooping ? "Loop (On)" : "Loop (Off)";
  // Indicate loop ON by lowering opacity, for fun
  this.style.opacity = isLooping ? "0.7" : "1.0";
}

/************************************
 * Shuffle the playlist
 ************************************/
function shufflePlaylist() {
  for (let i = videos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [videos[i], videos[j]] = [videos[j], videos[i]];
  }
  displayPlaylist(videos);
}

/************************************
 * Toggle Play/Pause with fade
 ************************************/
function togglePlayPause() {
  if (!player) return;
  const playPauseButton = document.getElementById("play-pause-button");
  const playerState = player.getPlayerState();

  // Fade out if currently playing
  if (playerState === YT.PlayerState.PLAYING && !isFading) {
    fadeVolume(0, 1000);
    playPauseButton.textContent = "▷";
  } 
  // Fade in if paused/ended
  else if ((playerState === YT.PlayerState.PAUSED || playerState === YT.PlayerState.ENDED) && !isFading) {
    player.setVolume(0);
    player.playVideo();
    fadeVolume(100, 1000);
    playPauseButton.textContent = "| |";
  }
}

/************************************
 * Next & Previous Song
 ************************************/
function playNextSong() {
  currentIndex = (currentIndex + 1) % videos.length;
  const nextVideo = videos[currentIndex];
  if (!nextVideo) return;
  playVideo(
    nextVideo.snippet.resourceId.videoId,
    nextVideo.snippet.title,
    (nextVideo.snippet.thumbnails.medium || {}).url || ""
  );
}

function playPreviousSong() {
  currentIndex = (currentIndex - 1 + videos.length) % videos.length;
  const prevVideo = videos[currentIndex];
  if (!prevVideo) return;
  playVideo(
    prevVideo.snippet.resourceId.videoId,
    prevVideo.snippet.title,
    (prevVideo.snippet.thumbnails.medium || {}).url || ""
  );
}

/************************************
 * Seek within the video
 ************************************/
function seekVideo(event) {
  const progressBar = event.target;
  const duration = player.getDuration() || 0;
  const seekTo = (progressBar.value / 100) * duration;
  player.seekTo(seekTo);
}

/************************************
 * Show slider tooltip
 ************************************/
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
  tooltip.style.left = (e.clientX - rect.left) + "px";
  tooltip.style.display = "block";
}

/************************************
 * Hide slider tooltip
 ************************************/
function hideSliderTooltip() {
  const tooltip = document.getElementById("slider-tooltip");
  tooltip.style.display = "none";
}

/************************************
 * onPlayerStateChange
 ************************************/
function onPlayerStateChange(event) {
  // Update total duration in "Playing Now"
  const totalDurationEl = document.getElementById("total-duration");
  if (totalDurationEl && player) {
    const d = player.getDuration();
    const mins = Math.floor(d / 60);
    const secs = Math.floor(d % 60).toString().padStart(2, "0");
    totalDurationEl.textContent = `${mins}:${secs}`;
  }

  // If loop ON and track ended, replay with fade in
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

      // Update slider
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
 * 1) Load the YT IFrame API
 ************************************/
const script = document.createElement("script");
script.src = "https://www.youtube.com/iframe_api";
document.body.appendChild(script);

/************************************
 * 2) Callback: IFrame ready
 ************************************/
function onYouTubeIframeAPIReady() {
  initializeYouTubePlayer();
}

/************************************
 * 3) Load Data API
 ************************************/
loadYouTubeAPI();
