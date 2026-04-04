const gameCards = document.querySelectorAll(".game-card");
const musicToggle = document.getElementById("musicToggle");

let audioContext = null;
let musicNodes = null;
let isMusicOn = false;

gameCards.forEach((card, index) => {
  window.setTimeout(() => {
    card.classList.add("visible");
  }, 140 * (index + 1));
});

function createMusicLoop() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  const masterGain = audioContext.createGain();
  masterGain.gain.value = 0.035;
  masterGain.connect(audioContext.destination);

  const oscillatorA = audioContext.createOscillator();
  const oscillatorB = audioContext.createOscillator();
  const oscillatorC = audioContext.createOscillator();

  oscillatorA.type = "sine";
  oscillatorB.type = "triangle";
  oscillatorC.type = "sine";

  oscillatorA.frequency.value = 220;
  oscillatorB.frequency.value = 277.18;
  oscillatorC.frequency.value = 329.63;

  oscillatorA.connect(masterGain);
  oscillatorB.connect(masterGain);
  oscillatorC.connect(masterGain);

  oscillatorA.start();
  oscillatorB.start();
  oscillatorC.start();

  const notes = [220, 261.63, 293.66, 329.63, 392];
  let step = 0;

  const intervalId = window.setInterval(() => {
    const now = audioContext.currentTime;
    const next = notes[step % notes.length];
    const harmony = notes[(step + 2) % notes.length];

    oscillatorA.frequency.setValueAtTime(next, now);
    oscillatorB.frequency.setValueAtTime(harmony, now);
    oscillatorC.frequency.setValueAtTime(next / 2, now);

    step += 1;
  }, 700);

  return { masterGain, oscillatorA, oscillatorB, oscillatorC, intervalId };
}

function stopMusicLoop() {
  if (!musicNodes) {
    return;
  }

  const now = audioContext.currentTime;
  musicNodes.masterGain.gain.cancelScheduledValues(now);
  musicNodes.masterGain.gain.setValueAtTime(musicNodes.masterGain.gain.value, now);
  musicNodes.masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.2);

  window.setTimeout(() => {
    musicNodes.oscillatorA.stop();
    musicNodes.oscillatorB.stop();
    musicNodes.oscillatorC.stop();
    window.clearInterval(musicNodes.intervalId);
    musicNodes = null;
  }, 220);
}

function updateMusicButton() {
  if (!musicToggle) {
    return;
  }

  musicToggle.textContent = isMusicOn ? "Music: On" : "Music: Off";
  musicToggle.classList.toggle("is-active", isMusicOn);
  musicToggle.setAttribute("aria-pressed", String(isMusicOn));
}

if (musicToggle) {
  musicToggle.addEventListener("click", async () => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      musicToggle.textContent = "Music Unsupported";
      musicToggle.disabled = true;
      return;
    }

    if (!isMusicOn) {
      if (!audioContext) {
        audioContext = new AudioContextClass();
      }

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      musicNodes = createMusicLoop();
      isMusicOn = true;
    } else {
      stopMusicLoop();
      isMusicOn = false;
    }

    updateMusicButton();
  });
}

updateMusicButton();
