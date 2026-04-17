const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreValue = document.getElementById("scoreValue");
const highScoreValue = document.getElementById("highScoreValue");
const levelValue = document.getElementById("levelValue");
const progressValue = document.getElementById("progressValue");
const progressBar = document.getElementById("progressBar");
const restartButton = document.getElementById("restartButton");
const muteButton = document.getElementById("muteButton");
const menuButton = document.getElementById("menuButton");
const statusBar = document.getElementById("statusBar");
const hudProgressShell = document.getElementById("hudProgressShell");
const levelMenu = document.getElementById("levelMenu");
const prevLevelButton = document.getElementById("prevLevelButton");
const nextLevelButton = document.getElementById("nextLevelButton");
const playLevelButton = document.getElementById("playLevelButton");
const menuLevelNumber = document.getElementById("menuLevelNumber");
const menuLevelTitle = document.getElementById("menuLevelTitle");
const menuLevelStatus = document.getElementById("menuLevelStatus");
const menuProgressPercent = document.getElementById("menuProgressPercent");
const menuProgressFill = document.getElementById("menuProgressFill");
const menuResultBanner = document.getElementById("menuResultBanner");
const menuResultTag = document.getElementById("menuResultTag");
const menuResultMessage = document.getElementById("menuResultMessage");
const levelDots = document.querySelectorAll(".level-dot");
const gameStage = document.getElementById("gameStage");
const selectorCard = document.querySelector(".selector-card");
const controlsPanel = document.querySelector(".controls-panel");

const HIGH_SCORE_KEY = "geometry-dash-high-score";
const LEVEL_PROGRESS_KEY = "geometry-dash-level-progress";
const BPM = 120;
const BEAT_DURATION_MS = (60 / BPM) * 1000;

const levels = [
  {
    name: "Stereo Madness",
    speed: 5.9,
    speedRamp: 0.00018,
    lengthBeats: 36,
    startBeats: 3,
    backgroundTop: "#0c1e37",
    backgroundBottom: "#09101d",
    ground: "#132243",
    accent: "#31e9ff",
    accentSoft: "rgba(49, 233, 255, 0.14)",
    patterns: [
      [{ type: "spike", width: 34, height: 40, beatsAfter: 2 }],
      [
        { type: "spike", width: 30, height: 36, beatsAfter: 1 },
        { type: "spike", width: 30, height: 48, beatsAfter: 2 }
      ],
      [{ type: "block", width: 42, height: 40, beatsAfter: 2 }]
    ],
    melody: [392, 523.25, 587.33, 523.25]
  },
  {
    name: "Back On Track",
    speed: 6.8,
    speedRamp: 0.00025,
    lengthBeats: 40,
    startBeats: 3,
    backgroundTop: "#191238",
    backgroundBottom: "#0a0d1b",
    ground: "#25184b",
    accent: "#ff4d9a",
    accentSoft: "rgba(255, 77, 154, 0.16)",
    patterns: [
      [
        { type: "spike", width: 30, height: 38, beatsAfter: 1 },
        { type: "spike", width: 30, height: 50, beatsAfter: 2 }
      ],
      [
        { type: "block", width: 42, height: 38, beatsAfter: 1 },
        { type: "spike", width: 34, height: 54, beatsAfter: 2 }
      ],
      [
        { type: "spike", width: 30, height: 40, beatsAfter: 1 },
        { type: "spike", width: 30, height: 50, beatsAfter: 1 },
        { type: "spike", width: 30, height: 60, beatsAfter: 2 }
      ]
    ],
    melody: [440, 659.25, 587.33, 698.46]
  },
  {
    name: "Polargeist",
    speed: 7.6,
    speedRamp: 0.00032,
    lengthBeats: 44,
    startBeats: 4,
    backgroundTop: "#122d28",
    backgroundBottom: "#08110f",
    ground: "#183932",
    accent: "#ffe44d",
    accentSoft: "rgba(255, 228, 77, 0.16)",
    patterns: [
      [
        { type: "spike", width: 28, height: 42, beatsAfter: 1 },
        { type: "spike", width: 28, height: 54, beatsAfter: 1 },
        { type: "spike", width: 28, height: 66, beatsAfter: 2 }
      ],
      [
        { type: "block", width: 40, height: 36, beatsAfter: 1 },
        { type: "block", width: 40, height: 48, beatsAfter: 1 },
        { type: "spike", width: 32, height: 62, beatsAfter: 2 }
      ],
      [
        { type: "spike", width: 30, height: 48, beatsAfter: 1 },
        { type: "block", width: 40, height: 40, beatsAfter: 1 },
        { type: "spike", width: 30, height: 64, beatsAfter: 2 }
      ]
    ],
    melody: [523.25, 659.25, 783.99, 698.46]
  }
];

const config = {
  gravity: 1.22,
  fallGravity: 1.78,
  jumpForce: -16.6,
  groundHeight: 72,
  pulseSpeed: 0.055,
  shakeDecay: 0.84,
  spawnLead: 420
};

let animationFrameId = null;
let audioContext = null;
let isMuted = false;
let highScore = readScore(HIGH_SCORE_KEY);
let levelProgress = readLevelProgress();

const state = {
  mode: "menu",
  running: false,
  gameOver: false,
  score: 0,
  totalDistance: 0,
  levelDistance: 0,
  speed: levels[0].speed,
  lastTimestamp: 0,
  nextSpawnBeat: 2,
  beatIndex: 0,
  lastTriggeredBeat: -1,
  pulse: 0,
  beatPulse: 0,
  flashAlpha: 0,
  shake: 0,
  playerTrail: 0,
  currentLevelIndex: 0,
  selectedLevelIndex: 0,
  lastLoggedProgress: -1,
  audioStartTime: null,
  currentBeat: 0,
  menuMessage: null,
  player: {
    x: 148,
    y: 0,
    size: 38,
    velocityY: 0,
    rotation: 0,
    grounded: true
  },
  obstacles: [],
  particles: []
};

function currentLevel() {
  return levels[state.currentLevelIndex];
}

function selectedLevel() {
  return levels[state.selectedLevelIndex];
}

function getLevelStorageId(levelIndex) {
  return `level${levelIndex + 1}`;
}

function createProgressEntry(entry = {}) {
  return {
    bestPercent: Math.max(0, Math.min(100, Number(entry.bestPercent) || 0)),
    completed: Boolean(entry.completed)
  };
}

function getLevelDistanceTarget() {
  return currentLevel().lengthBeats * getPixelsPerBeat();
}

function getBeatDurationMs() {
  return BEAT_DURATION_MS;
}

function getBeatDurationSeconds() {
  return BEAT_DURATION_MS / 1000;
}

function getCurrentProgressPercent() {
  const targetDistance = Math.max(1, getLevelDistanceTarget());
  return Math.min(100, Math.floor((state.levelDistance / targetDistance) * 100));
}

function readScore(key) {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch (error) {
    return 0;
  }
}

function writeScore(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch (error) {
    // Ignore storage issues so gameplay still works.
  }
}

function readLevelProgress() {
  try {
    const raw = localStorage.getItem(LEVEL_PROGRESS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};

    return levels.map((_, index) => {
      const legacyEntry = Array.isArray(parsed) ? parsed[index] : null;
      const objectEntry = !Array.isArray(parsed) ? parsed[getLevelStorageId(index)] : null;
      return createProgressEntry(objectEntry || legacyEntry || {});
    });
  } catch (error) {
    return levels.map(() => createProgressEntry());
  }
}

function writeLevelProgress() {
  try {
    const payload = {};

    levels.forEach((_, index) => {
      payload[getLevelStorageId(index)] = levelProgress[index];
    });

    localStorage.setItem(LEVEL_PROGRESS_KEY, JSON.stringify(payload));
  } catch (error) {
    // Ignore storage failures so gameplay still works.
  }
}

function saveLevelProgress(levelIndex, percent) {
  const normalizedPercent = Math.max(0, Math.min(100, Math.floor(percent)));
  const entry = levelProgress[levelIndex];
  const previousBest = entry.bestPercent;

  if (normalizedPercent > entry.bestPercent) {
    entry.bestPercent = normalizedPercent;
  }

  if (normalizedPercent >= 100) {
    entry.completed = true;
  }

  writeLevelProgress();

  console.debug("[Neon Cube] Save progress", {
    level: getLevelStorageId(levelIndex),
    percent: normalizedPercent,
    previousBest,
    savedBest: entry.bestPercent,
    completed: entry.completed
  });

  return entry;
}

function ensureAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  return audioContext;
}

function updateMuteButton() {
  muteButton.textContent = isMuted ? "Music: Off" : "Music: On";
  muteButton.classList.toggle("is-muted", isMuted);
}

function playTone(frequency, duration, volume, type = "triangle") {
  const context = ensureAudio();

  if (!context || isMuted) {
    return;
  }

  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function playBeat() {
  const level = currentLevel();
  const note = level.melody[state.beatIndex % level.melody.length];
  const kick = state.beatIndex % 4 === 0 ? note / 2 : note * 0.75;

  playTone(kick, 0.12, 0.05, "sine");
  playTone(note, 0.16, 0.028, state.beatIndex % 2 === 0 ? "triangle" : "square");
  state.beatPulse = 1;

  console.debug("[Neon Cube] Beat tick", {
    beat: state.beatIndex,
    bpm: BPM,
    beatDurationMs: getBeatDurationMs()
  });
}

function getAudioElapsedSeconds() {
  if (!audioContext || state.audioStartTime === null) {
    return 0;
  }

  return Math.max(0, audioContext.currentTime - state.audioStartTime);
}

function getCurrentBeatFromAudio() {
  return getAudioElapsedSeconds() / getBeatDurationSeconds();
}

function getGroundY() {
  return canvas.height - config.groundHeight;
}

function getPixelsPerBeat() {
  return currentLevel().speed * (getBeatDurationMs() / (1000 / 60));
}

function updateHudStats() {
  const progress = getCurrentProgressPercent();

  scoreValue.textContent = String(state.score);
  highScoreValue.textContent = String(highScore);
  levelValue.textContent = String(state.currentLevelIndex + 1);
  progressValue.textContent = `${progress}%`;
  progressBar.style.width = `${progress}%`;
}

function renderMenuCard() {
  const levelIndex = state.selectedLevelIndex;
  const entry = levelProgress[levelIndex];

  menuLevelNumber.textContent = `Level ${levelIndex + 1}`;
  menuLevelTitle.textContent = selectedLevel().name;
  menuLevelStatus.textContent = entry.completed ? "Completed" : `Best: ${entry.bestPercent}%`;
  menuLevelStatus.classList.toggle("is-complete", entry.completed);
  menuProgressPercent.textContent = `${entry.bestPercent}%`;
  menuProgressFill.style.width = `${entry.bestPercent}%`;

  levelDots.forEach((dot) => {
    dot.classList.toggle("is-active", Number(dot.dataset.levelIndex) === levelIndex);
  });

  prevLevelButton.disabled = state.mode === "playing";
  nextLevelButton.disabled = state.mode === "playing";
}

function animateSelectorCard(mode = "switch") {
  if (!selectorCard) {
    return;
  }

  if (mode === "enter") {
    selectorCard.classList.remove("is-entering");
    window.requestAnimationFrame(() => {
      selectorCard.classList.add("is-entering");
      window.setTimeout(() => {
        selectorCard.classList.remove("is-entering");
      }, 320);
    });
    return;
  }

  selectorCard.classList.remove("is-switching");
  window.requestAnimationFrame(() => {
    selectorCard.classList.add("is-switching");
    window.setTimeout(() => {
      selectorCard.classList.remove("is-switching");
    }, 220);
  });
}

function showMenuBanner(tag, message, tone) {
  state.menuMessage = { tag, message, tone };
  menuResultTag.textContent = tag;
  menuResultMessage.textContent = message;
  menuResultBanner.classList.remove("hidden", "is-complete", "is-failed");
  if (tone === "complete") {
    menuResultBanner.classList.add("is-complete");
  } else if (tone === "failed") {
    menuResultBanner.classList.add("is-failed");
  }
}

function hideMenuBanner() {
  state.menuMessage = null;
  menuResultBanner.classList.add("hidden");
  menuResultBanner.classList.remove("is-complete", "is-failed");
}

function renderMenuMessage() {
  if (!state.menuMessage) {
    hideMenuBanner();
    return;
  }

  showMenuBanner(state.menuMessage.tag, state.menuMessage.message, state.menuMessage.tone);
}

function setMode(mode) {
  state.mode = mode;
  state.running = mode === "playing";
  state.gameOver = mode === "gameOver";

  const showMenu = mode !== "playing";
  levelMenu.classList.toggle("hidden", !showMenu);
  gameStage.classList.toggle("hidden", mode !== "playing");
  statusBar.classList.add("hidden");
  hudProgressShell.classList.add("hidden");
  restartButton.classList.toggle("hidden", mode !== "playing");
  menuButton.classList.toggle("hidden", showMenu);
  controlsPanel.classList.toggle("hidden", showMenu);
}

function resetPlayer() {
  state.player.y = getGroundY() - state.player.size;
  state.player.velocityY = 0;
  state.player.rotation = 0;
  state.player.grounded = true;
}

function spawnJumpParticles() {
  for (let index = 0; index < 6; index += 1) {
    state.particles.push({
      x: state.totalDistance + state.player.x + 8 + Math.random() * 18,
      y: getGroundY() - 8,
      vx: -2.6 - Math.random() * 1.8,
      vy: -0.8 - Math.random() * 1.8,
      size: 4 + Math.random() * 3,
      life: 18 + Math.random() * 8,
      color: index % 2 === 0 ? currentLevel().accent : "#ffffff"
    });
  }
}

function spawnCollisionParticles() {
  const centerX = state.totalDistance + state.player.x + state.player.size / 2;
  const centerY = state.player.y + state.player.size / 2;

  for (let index = 0; index < 18; index += 1) {
    state.particles.push({
      x: centerX,
      y: centerY,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.6) * 7,
      size: 4 + Math.random() * 5,
      life: 18 + Math.random() * 14,
      color: index % 2 === 0 ? "#ff4d9a" : currentLevel().accent
    });
  }
}

function applyLevelTheme() {
  const level = currentLevel();
  document.documentElement.style.setProperty("--bg-top", level.backgroundTop);
  document.documentElement.style.setProperty("--bg-bottom", level.backgroundBottom);
  document.documentElement.style.setProperty("--cyan", level.accent);
  document.documentElement.style.setProperty("--progress", level.accent);
}

function prepareLevel(levelIndex) {
  state.currentLevelIndex = levelIndex;
  state.score = 0;
  state.totalDistance = 0;
  state.levelDistance = 0;
  state.speed = currentLevel().speed;
  state.lastTimestamp = 0;
  state.nextSpawnBeat = currentLevel().startBeats;
  state.beatIndex = 0;
  state.lastTriggeredBeat = -1;
  state.currentBeat = 0;
  state.audioStartTime = null;
  state.flashAlpha = 0;
  state.beatPulse = 0;
  state.shake = 0;
  state.playerTrail = 0;
  state.lastLoggedProgress = -1;
  state.obstacles = [];
  state.particles = [];
  state.pulse = 0;
  resetPlayer();
  applyLevelTheme();
  updateHudStats();
  draw();
}

function selectLevel(levelIndex) {
  if (state.mode === "playing") {
    return;
  }

  const count = levels.length;
  state.selectedLevelIndex = (levelIndex + count) % count;
  console.debug("[Neon Cube] Select level", {
    level: getLevelStorageId(state.selectedLevelIndex),
    name: selectedLevel().name
  });
  animateSelectorCard("switch");
  renderMenuCard();
}

function showMenu(levelIndex = state.selectedLevelIndex) {
  state.selectedLevelIndex = levelIndex;
  applyLevelTheme();
  setMode("menu");
  animateSelectorCard("enter");
  renderMenuCard();
  renderMenuMessage();
}

function startGame(levelIndex) {
  if (window.ArcadeLeaderboard) {
    window.ArcadeLeaderboard.startRun();
  }

  state.selectedLevelIndex = levelIndex;
  prepareLevel(levelIndex);
  const context = ensureAudio();
  hideMenuBanner();
  setMode("playing");
  gameStage.classList.remove("hidden");
  state.audioStartTime = context ? context.currentTime : null;
  state.lastTriggeredBeat = -1;
  state.currentBeat = 0;
  state.lastLoggedProgress = -1;

  console.debug("[Neon Cube] Start game", {
    level: getLevelStorageId(levelIndex),
    name: currentLevel().name,
    bpm: BPM,
    beatDurationMs: getBeatDurationMs(),
    audioStartTime: state.audioStartTime
  });

  syncToAudioClock();
}

function restartCurrentLevel() {
  console.debug("[Neon Cube] Restart level", {
    level: getLevelStorageId(state.currentLevelIndex)
  });
  startGame(state.currentLevelIndex);
}

function returnToSelectorWithMessage(levelIndex, tag, message, tone) {
  state.selectedLevelIndex = levelIndex;
  showMenu(levelIndex);
  showMenuBanner(tag, message, tone);
  renderMenuCard();
}

function completeLevel() {
  const completedPercent = 100;
  const currentIndex = state.currentLevelIndex;
  const nextLevelIndex = (currentIndex + 1) % levels.length;
  const hasNextLevel = currentIndex + 1 < levels.length;

  console.debug("[Neon Cube] Level completion trigger", {
    level: getLevelStorageId(currentIndex),
    percent: completedPercent,
    distance: state.levelDistance,
    targetDistance: getLevelDistanceTarget()
  });

  setMode("levelComplete");
  saveLevelProgress(currentIndex, completedPercent);

  if (state.score > highScore) {
    highScore = state.score;
    writeScore(HIGH_SCORE_KEY, highScore);
  }

  updateHudStats();
  returnToSelectorWithMessage(
    hasNextLevel ? nextLevelIndex : currentIndex,
    "Level Complete",
    hasNextLevel
      ? `${levels[currentIndex].name} is complete. ${levels[nextLevelIndex].name} is ready to play.`
      : `${levels[currentIndex].name} is complete. You cleared every level in Neon Cube.`,
    "complete"
  );

  if (window.ArcadeLeaderboard) {
    window.ArcadeLeaderboard.submitScore(state.score);
  }
}

function endGame() {
  const reachedPercent = getCurrentProgressPercent();
  const currentIndex = state.currentLevelIndex;
  const savedEntry = saveLevelProgress(currentIndex, reachedPercent);

  console.debug("[Neon Cube] Game over", {
    level: getLevelStorageId(currentIndex),
    reachedPercent,
    bestPercent: savedEntry.bestPercent
  });

  state.flashAlpha = 0.55;
  state.shake = 16;
  spawnCollisionParticles();

  if (state.score > highScore) {
    highScore = state.score;
    writeScore(HIGH_SCORE_KEY, highScore);
  }

  updateHudStats();
  setMode("gameOver");
  returnToSelectorWithMessage(
    currentIndex,
    "Attempt Complete",
    `You reached ${reachedPercent}% on ${levels[currentIndex].name}. Best: ${savedEntry.bestPercent}%.`,
    "failed"
  );

  if (window.ArcadeLeaderboard) {
    window.ArcadeLeaderboard.submitScore(state.score);
  }
}

function queuePatternIfNeeded() {
  const cameraAnchor = state.totalDistance + state.player.x - 120;
  const pixelsPerBeat = getPixelsPerBeat();

  while (state.nextSpawnBeat * pixelsPerBeat - cameraAnchor < canvas.width + config.spawnLead) {
    const patterns = currentLevel().patterns;
    const pattern = patterns[state.beatIndex % patterns.length];
    let cursorBeat = state.nextSpawnBeat;

    pattern.forEach((piece) => {
      state.obstacles.push({
        type: piece.type,
        x: cursorBeat * pixelsPerBeat,
        width: piece.width,
        height: piece.height
      });

      cursorBeat += piece.beatsAfter;
    });

    state.nextSpawnBeat = cursorBeat + 1;
  }
}

function syncToAudioClock() {
  if (!state.running) {
    return;
  }

  state.currentBeat = getCurrentBeatFromAudio();
  const wholeBeat = Math.floor(state.currentBeat);
  state.beatIndex = wholeBeat;

  while (state.lastTriggeredBeat < wholeBeat) {
    state.lastTriggeredBeat += 1;
    playBeat();

    if (state.lastTriggeredBeat % 4 === 0) {
      console.debug("[Neon Cube] Audio sync", {
        audioTime: Number(getAudioElapsedSeconds().toFixed(3)),
        currentBeat: Number(state.currentBeat.toFixed(3)),
        wholeBeat: state.lastTriggeredBeat
      });
    }
  }

  state.levelDistance = state.currentBeat * getPixelsPerBeat();
  state.totalDistance = state.levelDistance;
  state.score = Math.floor(state.levelDistance / 12);
}

function updatePlayer(deltaFactor) {
  const gravity = state.player.velocityY < 0 ? config.gravity : config.fallGravity;
  state.player.velocityY += gravity * deltaFactor;
  state.player.y += state.player.velocityY * deltaFactor;
  state.player.rotation = Math.min(1.35, state.player.rotation + 0.075 * deltaFactor);
  state.playerTrail = Math.max(0, state.playerTrail - 0.08 * deltaFactor);

  const groundY = getGroundY() - state.player.size;

  if (state.player.y >= groundY) {
    state.player.y = groundY;
    state.player.velocityY = 0;
    state.player.rotation = 0;
    state.player.grounded = true;
  }
}

function updateLevelProgress(deltaFactor, deltaMs) {
  syncToAudioClock();

  for (let index = state.obstacles.length - 1; index >= 0; index -= 1) {
    const obstacle = state.obstacles[index];

    if (obstacle.x + obstacle.width < state.totalDistance + state.player.x - 260) {
      state.obstacles.splice(index, 1);
    }
  }

  queuePatternIfNeeded();

  const progress = getCurrentProgressPercent();
  if (
    progress !== state.lastLoggedProgress &&
    (progress % 25 === 0 || progress >= 95)
  ) {
    console.debug("[Neon Cube] Progress calculation", {
      level: getLevelStorageId(state.currentLevelIndex),
      progress,
      distance: Math.floor(state.levelDistance),
      targetDistance: Math.floor(getLevelDistanceTarget())
    });
  }
  state.lastLoggedProgress = progress;

  const currentBeatRemainderMs = (state.currentBeat % 1) * getBeatDurationMs();

  if (state.beatIndex > 0 && state.beatIndex % 8 === 0 && currentBeatRemainderMs < deltaMs + 1) {
    console.debug("[Neon Cube] Beat sync", {
      beat: state.beatIndex,
      beatClockRemainderMs: Math.round(currentBeatRemainderMs),
      nextSpawnBeat: state.nextSpawnBeat
    });
  }

  if (state.levelDistance >= getLevelDistanceTarget()) {
    completeLevel();
    return;
  }

  updateHudStats();
}

function updateParticles(deltaFactor) {
  for (let index = state.particles.length - 1; index >= 0; index -= 1) {
    const particle = state.particles[index];
    particle.x += particle.vx * deltaFactor;
    particle.y += particle.vy * deltaFactor;
    particle.vy += 0.18 * deltaFactor;
    particle.life -= deltaFactor;

    if (particle.life <= 0) {
      state.particles.splice(index, 1);
    }
  }
}

function updateEffects(deltaFactor) {
  state.pulse += (config.pulseSpeed + state.beatPulse * 0.035) * deltaFactor;
  state.beatPulse = Math.max(0, state.beatPulse - 0.08 * deltaFactor);
  state.flashAlpha = Math.max(0, state.flashAlpha - 0.03 * deltaFactor);
  state.shake *= Math.pow(config.shakeDecay, deltaFactor);

  if (state.shake < 0.2) {
    state.shake = 0;
  }
}

function checkCollision() {
  const playerLeft = state.player.x + 5;
  const playerRight = state.player.x + state.player.size - 5;
  const playerTop = state.player.y + 5;
  const playerBottom = state.player.y + state.player.size - 4;
  const groundY = getGroundY();

  for (const obstacle of state.obstacles) {
    const screenX = obstacle.x - state.totalDistance;
    const obstacleTop = groundY - obstacle.height;

    if (obstacle.type === "block") {
      const overlaps =
        playerRight > screenX + 3 &&
        playerLeft < screenX + obstacle.width - 3 &&
        playerBottom > obstacleTop + 3 &&
        playerTop < groundY - 2;

      if (overlaps) {
        return true;
      }

      continue;
    }

    const spikeLeft = screenX + 5;
    const spikeRight = screenX + obstacle.width - 5;
    const spikeTop = obstacleTop + 10;
    const overlapsSpike =
      playerRight > spikeLeft &&
      playerLeft < spikeRight &&
      playerBottom > spikeTop &&
      playerTop < groundY - 2;

    if (overlapsSpike) {
      return true;
    }
  }

  return false;
}

function drawBackground() {
  const level = currentLevel();
  const pulse = (Math.sin(state.pulse) + 1) / 2;
  const beatGlow = state.beatPulse * 0.45;
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, level.backgroundTop);
  gradient.addColorStop(0.52, level.backgroundBottom);
  gradient.addColorStop(1, "#07101d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = `rgba(255, 255, 255, ${0.025 + beatGlow * 0.08})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = level.accentSoft;
  ctx.beginPath();
  ctx.arc(canvas.width * 0.18, canvas.height * 0.2, 120 + pulse * 16 + beatGlow * 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgba(255, 255, 255, ${0.035 + pulse * 0.025 + beatGlow * 0.08})`;
  ctx.beginPath();
  ctx.arc(canvas.width * 0.82, canvas.height * 0.18, 92 + pulse * 12 + beatGlow * 14, 0, Math.PI * 2);
  ctx.fill();

  const gridOffset = -(state.totalDistance * 0.35) % 64;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.lineWidth = 1;

  for (let x = gridOffset; x <= canvas.width + 64; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
}

function drawGround() {
  const level = currentLevel();
  const groundY = getGroundY();
  const lineOffset = -(state.totalDistance * 0.8) % 54;

  ctx.fillStyle = level.ground;
  ctx.fillRect(0, groundY, canvas.width, config.groundHeight);

  for (let x = lineOffset; x <= canvas.width + 54; x += 54) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.fillRect(x, groundY + 12, 28, 3);
  }

  ctx.strokeStyle = level.accent;
  ctx.lineWidth = 4 + state.beatPulse * 1.6;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(canvas.width, groundY);
  ctx.stroke();
}

function drawPlayer() {
  if (state.playerTrail > 0) {
    ctx.save();
    ctx.globalAlpha = state.playerTrail * 0.35;
    ctx.fillStyle = currentLevel().accent;
    ctx.fillRect(state.player.x - 18, state.player.y + 6, 14, state.player.size - 12);
    ctx.restore();
  }

  ctx.save();
  ctx.translate(state.player.x + state.player.size / 2, state.player.y + state.player.size / 2);
  ctx.rotate(state.player.rotation);
  ctx.shadowColor = "rgba(255, 228, 77, 0.75)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#ffe44d";
  ctx.fillRect(-state.player.size / 2, -state.player.size / 2, state.player.size, state.player.size);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#10213a";
  ctx.fillRect(-10, -6, 6, 6);
  ctx.fillRect(4, -6, 6, 6);
  ctx.restore();
}

function drawObstacles() {
  const groundY = getGroundY();

  for (const obstacle of state.obstacles) {
    const screenX = obstacle.x - state.totalDistance;

    if (screenX > canvas.width + 60 || screenX + obstacle.width < -60) {
      continue;
    }

    if (obstacle.type === "block") {
      ctx.save();
      ctx.shadowColor = `${currentLevel().accent}88`;
      ctx.shadowBlur = 12;
      ctx.fillStyle = currentLevel().accent;
      ctx.fillRect(screenX, groundY - obstacle.height, obstacle.width, obstacle.height);
      ctx.restore();

      ctx.fillStyle = "#0a1730";
      ctx.fillRect(screenX + 8, groundY - obstacle.height + 8, obstacle.width - 16, obstacle.height - 16);
      continue;
    }

    ctx.fillStyle = "#ff4d9a";
    ctx.beginPath();
    ctx.moveTo(screenX, groundY);
    ctx.lineTo(screenX + obstacle.width / 2, groundY - obstacle.height);
    ctx.lineTo(screenX + obstacle.width, groundY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawParticles() {
  for (const particle of state.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, particle.life / 24);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x - state.totalDistance, particle.y, particle.size, particle.size);
    ctx.restore();
  }
}

function drawFlash() {
  if (state.flashAlpha <= 0) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = state.flashAlpha;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function draw() {
  const shakeX = state.shake ? (Math.random() - 0.5) * state.shake : 0;
  const shakeY = state.shake ? (Math.random() - 0.5) * state.shake * 0.6 : 0;

  ctx.save();
  ctx.translate(shakeX, shakeY);
  drawBackground();
  drawGround();
  drawObstacles();
  drawParticles();
  drawPlayer();
  ctx.restore();
  drawFlash();
}

function gameLoop(timestamp) {
  if (!state.lastTimestamp) {
    state.lastTimestamp = timestamp;
  }

  const deltaFactor = Math.min(2.2, (timestamp - state.lastTimestamp) / (1000 / 60));
  const deltaMs = Math.min(36, timestamp - state.lastTimestamp);
  state.lastTimestamp = timestamp;

  if (state.running) {
    updatePlayer(deltaFactor);
    updateLevelProgress(deltaFactor, deltaMs);
  }

  updateParticles(deltaFactor);
  updateEffects(deltaFactor);
  draw();

  if (state.running && checkCollision()) {
    endGame();
  }

  animationFrameId = window.requestAnimationFrame(gameLoop);
}

function triggerJump() {
  state.player.velocityY = config.jumpForce;
  state.player.grounded = false;
  state.player.rotation = -0.28;
  state.playerTrail = 1;
  spawnJumpParticles();
}

function handlePointerInput(event) {
  if (state.mode !== "playing") {
    return;
  }

  if (event.target.closest("button")) {
    return;
  }

  event.preventDefault();

  if (!state.player.grounded) {
    return;
  }

  triggerJump();
}

function handleKeyboardInput(event) {
  if (event.code !== "Space") {
    return;
  }

  event.preventDefault();

  if (state.mode === "playing") {
    if (state.player.grounded) {
      triggerJump();
    }
    return;
  }

  if (state.mode !== "playing") {
    startGame(state.selectedLevelIndex);
  }
}

restartButton.addEventListener("click", () => {
  restartCurrentLevel();
});

menuButton.addEventListener("click", () => {
  showMenu(state.currentLevelIndex);
});

muteButton.addEventListener("click", () => {
  isMuted = !isMuted;
  updateMuteButton();
});

prevLevelButton.addEventListener("click", () => {
  selectLevel(state.selectedLevelIndex - 1);
});

nextLevelButton.addEventListener("click", () => {
  selectLevel(state.selectedLevelIndex + 1);
});

playLevelButton.addEventListener("click", () => {
  console.debug("[Neon Cube] Play button click", {
    selectedLevel: getLevelStorageId(state.selectedLevelIndex),
    name: selectedLevel().name
  });
  startGame(state.selectedLevelIndex);
});

levelDots.forEach((dot) => {
  dot.addEventListener("click", () => {
    selectLevel(Number(dot.dataset.levelIndex));
  });
});

canvas.addEventListener("pointerdown", handlePointerInput);
document.addEventListener("keydown", handleKeyboardInput);

updateMuteButton();
if (window.ArcadeLeaderboard) {
  window.ArcadeLeaderboard.configure({
    game: "Geometry Dash"
  });
}
applyLevelTheme();
updateHudStats();
showMenu(0);
animationFrameId = window.requestAnimationFrame(gameLoop);
