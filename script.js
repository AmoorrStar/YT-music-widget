/************************************
 * Smooth Play/Stop for Fn + F8 Fix
 ************************************/
function togglePlayPauseFnSmooth() {
  if (!player) return;
  const state = player.getPlayerState();

  if (state === YT.PlayerState.PLAYING && !isFading) {
    fadeVolume(0, 1000); // Fade out
  } else if (
    (state === YT.PlayerState.PAUSED || state === YT.PlayerState.ENDED) &&
    !isFading
  ) {
    player.setVolume(0);
    player.playVideo();
    fadeVolume(100, 1000); // Fade in
  }
}

/* Hook Fn + F8 Keypress */
document.addEventListener("keydown", (e) => {
  if (e.key === "MediaPlayPause") {
    togglePlayPauseFnSmooth();
  }
});
