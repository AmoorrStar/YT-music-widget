/***************************************
 * Local Storage keys
 ***************************************/
const STORAGE_KEY = "youtubeWidgetData"; 
// We'll store an object { apiKey: string, playlists: string[] } in localStorage.

/***************************************
 * Global Data
 ***************************************/
let userData = {
  apiKey: "",
  playlists: [],
};
let currentPlaylistIndex = 0;

/***************************************
 * On Page Load
 ***************************************/
window.addEventListener("DOMContentLoaded", () => {
  loadUserData(); // Attempt to load from localStorage
  initUI();
  initWidget();
});

/***************************************
 * Load from localStorage
 ***************************************/
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

/***************************************
 * Save to localStorage
 ***************************************/
function saveUserData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
}

/***************************************
 * Initialize UI
 ***************************************/
function initUI() {
  const manageButton = document.getElementById("manage-api-button");
  const changePlaylistButton = document.getElementById("change-playlist-button");
  const manageModal = document.getElementById("manage-modal");
  const apiKeyInput = document.getElementById("apiKeyInput");
  const playlistInput = document.getElementById("playlistInput");
  const addPlaylistBtn = document.getElementById("addPlaylistBtn");
  const playlistsList = document.getElementById("playlistsList");
  const saveChangesBtn = document.getElementById("saveChangesBtn");

  // If user data is empty, open the modal automatically
  if (!userData.apiKey) {
    manageModal.style.display = "block";
  }

  manageButton.addEventListener("click", () => {
    // Open the modal & populate fields
    apiKeyInput.value = userData.apiKey || "";
    renderPlaylistsList();
    manageModal.style.display = "block";
  });

  changePlaylistButton.addEventListener("click", () => {
    // Quick switch to another playlist from user's saved ones
    if (userData.playlists.length < 2) {
      alert("You have only one or no playlists saved. Add more in 'Manage API Key & Playlists'.");
      return;
    }
    // Simple prompt approach:
    let msg = "Choose a playlist index:\n";
    userData.playlists.forEach((pl, i) => {
      msg += `${i}. ${pl}\n`;
    });
    const choice = parseInt(prompt(msg, "0"), 10);
    if (!isNaN(choice) && userData.playlists[choice]) {
      currentPlaylistIndex = choice;
      reloadYouTubeWidget(); // We'll define a function to re-init the widget
    }
  });

  // Add a new playlist ID
  addPlaylistBtn.addEventListener("click", () => {
    const newPl = playlistInput.value.trim();
    if (!newPl) return;
    userData.playlists.push(newPl);
    playlistInput.value = "";
    renderPlaylistsList();
  });

  function renderPlaylistsList() {
    // Clear old
    playlistsList.innerHTML = "";
    userData.playlists.forEach((pl, i) => {
      const li = document.createElement("li");
      li.textContent = `(${i}) ${pl}`;
      playlistsList.appendChild(li);
    });
  }

  // Save & close
  saveChangesBtn.addEventListener("click", () => {
    userData.apiKey = apiKeyInput.value.trim();
    saveUserData();
    manageModal.style.display = "none";
    reloadYouTubeWidget(); // re-init YT with new key or playlists
  });
}

/***************************************
 * Initialize/Reload the Widget
 * (This is where you'd integrate your YT code)
 ***************************************/
function initWidget() {
  // Here you'd place or call your existing YT init code,
  // using userData.apiKey and userData.playlists[ currentPlaylistIndex ]
  console.log("INIT WIDGET - using key:", userData.apiKey);
  if (userData.playlists.length) {
    console.log("Current playlist ID is:", userData.playlists[currentPlaylistIndex]);
  }
  // Load the YT Data API with userData.apiKey,
  // then fetch playlist videos using userData.playlists[currentPlaylistIndex], etc...
}

/***************************************
 * Reload YT widget with new data
 ***************************************/
function reloadYouTubeWidget() {
  console.log("Reloading widget with new API key / playlist info...");
  // Possibly tear down old player references if needed
  // Then re-init your widget code
  initWidget();
}
