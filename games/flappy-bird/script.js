const gameArea = document.getElementById("game-area");
const bird = document.getElementById("bird");
const pipeLayer = document.getElementById("pipe-layer");
const scoreCard = document.getElementById("score-card");
const scoreElement = document.getElementById("score");
const bestScoreElement = document.getElementById("best-score");
const finalScoreElement = document.getElementById("final-score");
const finalBestScoreElement = document.getElementById("final-best-score");
const startScreen = document.getElementById("start-screen");
const gameOverScreen = document.getElementById("game-over-screen");
const startButton = document.getElementById("start-button");
const restartButton = document.getElementById("restart-button");

const physics = {
  gravity: 0.42,
  jumpForce: -7.4,
  pipeSpeed: 2.8,
  pipeWidth: 72,
  pipeGap: 170,
  pipeInterval: 1450,
  groundHeight: 92,
};

const sounds = {
  context: null,
  enabled: false,
};

function readBestScore() {
  try {
    return Number(localStorage.getItem("flappy-bird-best-score")) || 0;
  } catch (error) {
    return 0;
  }
}

function writeBestScore(score) {
  try {
    localStorage.setItem("flappy-bird-best-score", String(score));
  } catch (error) {
    // Ignore storage issues so gameplay still works in restricted browsers.
  }
}

const state = {
  birdY: 0,
  birdVelocity: 0,
  pipes: [],
  score: 0,
  bestScore: readBestScore(),
  gameStarted: false,
  gameOver: false,
  animationFrameId: null,
  lastFrameTime: 0,
  lastPipeTime: 0,
};

bestScoreElement.textContent = state.bestScore;

function syncGroundHeight() {
  const isMobile = window.innerWidth <= 700;
  physics.groundHeight = isMobile ? 84 : 92;
  physics.pipeGap = isMobile ? 156 : 170;
}

function getAreaHeight() {
  return gameArea.clientHeight;
}

function getBirdHeight() {
  return bird.offsetHeight;
}

function setBirdPosition() {
  bird.style.top = `${state.birdY}px`;
}

function setBirdRotation() {
  const angle = Math.max(-28, Math.min(78, state.birdVelocity * 5.6 - 8));
  const liftOffset = state.birdVelocity < -1 ? -2 : 0;
  bird.style.transform = `translateY(${liftOffset}px) rotate(${angle}deg)`;
}

function ensureAudioReady() {
  if (!window.AudioContext && !window.webkitAudioContext) {
    return;
  }

  if (!sounds.context) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    sounds.context = new AudioCtor();
  }

  if (sounds.context.state === "suspended") {
    sounds.context.resume();
  }

  sounds.enabled = true;
}

function playTone({ frequency, duration, type = "sine", volume = 0.05, slideTo }) {
  if (!sounds.enabled || !sounds.context) {
    return;
  }

  const now = sounds.context.currentTime;
  const oscillator = sounds.context.createOscillator();
  const gainNode = sounds.context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);

  if (slideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
  }

  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(gainNode);
  gainNode.connect(sounds.context.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function playJumpSound() {
  playTone({
    frequency: 620,
    slideTo: 860,
    duration: 0.08,
    type: "triangle",
    volume: 0.035,
  });
}

function playPointSound() {
  playTone({
    frequency: 880,
    slideTo: 1180,
    duration: 0.1,
    type: "square",
    volume: 0.03,
  });
}

function playGameOverSound() {
  playTone({
    frequency: 360,
    slideTo: 140,
    duration: 0.28,
    type: "sawtooth",
    volume: 0.04,
  });
}

function triggerFlapAnimation() {
  bird.classList.remove("flap-boost");
  void bird.offsetWidth;
  bird.classList.add("flap-boost");

  window.clearTimeout(triggerFlapAnimation.timeoutId);
  triggerFlapAnimation.timeoutId = window.setTimeout(() => {
    bird.classList.remove("flap-boost");
  }, 180);
}

function triggerScoreAnimation() {
  scoreCard.classList.remove("score-card-pop");
  void scoreCard.offsetWidth;
  scoreCard.classList.add("score-card-pop");

  window.clearTimeout(triggerScoreAnimation.timeoutId);
  triggerScoreAnimation.timeoutId = window.setTimeout(() => {
    scoreCard.classList.remove("score-card-pop");
  }, 220);
}

function triggerCollisionFeedback() {
  gameArea.classList.remove("shake");
  void gameArea.offsetWidth;
  gameArea.classList.add("shake");

  window.clearTimeout(triggerCollisionFeedback.timeoutId);
  triggerCollisionFeedback.timeoutId = window.setTimeout(() => {
    gameArea.classList.remove("shake");
  }, 340);
}

function updateScore(nextScore) {
  const previousScore = state.score;
  state.score = nextScore;
  scoreElement.textContent = state.score;

  if (state.score > previousScore) {
    triggerScoreAnimation();
    playPointSound();
  }

  if (state.score > state.bestScore) {
    state.bestScore = state.score;
    bestScoreElement.textContent = state.bestScore;
    writeBestScore(state.bestScore);
  }
}

function resetBird() {
  state.birdVelocity = 0;
  state.birdY = getAreaHeight() * 0.38;
  setBirdPosition();
  setBirdRotation();
}

function clearPipes() {
  for (const pipePair of state.pipes) {
    pipePair.topElement.remove();
    pipePair.bottomElement.remove();
  }
  state.pipes = [];
}

function showStartScreen() {
  gameArea.classList.add("pre-game");
  startScreen.classList.remove("hidden");
  startScreen.classList.add("visible");
}

function hideStartScreen() {
  gameArea.classList.remove("pre-game");
  startScreen.classList.remove("visible");
  startScreen.classList.add("hidden");
}

function showGameOverScreen() {
  finalScoreElement.textContent = state.score;
  finalBestScoreElement.textContent = state.bestScore;
  gameOverScreen.classList.remove("hidden");
}

function hideGameOverScreen() {
  gameOverScreen.classList.add("hidden");
}

function createPipePair() {
  const areaHeight = getAreaHeight();
  const usableHeight = areaHeight - physics.groundHeight;
  const topMin = 60;
  const topMax = usableHeight - physics.pipeGap - 60;
  const topHeight = Math.max(topMin, Math.random() * (topMax - topMin) + topMin);
  const bottomHeight = usableHeight - topHeight - physics.pipeGap;

  const topPipe = document.createElement("div");
  topPipe.className = "pipe pipe-top";
  topPipe.style.height = `${topHeight}px`;
  topPipe.style.left = `${gameArea.clientWidth}px`;
  topPipe.style.top = "0";

  const bottomPipe = document.createElement("div");
  bottomPipe.className = "pipe pipe-bottom";
  bottomPipe.style.height = `${bottomHeight}px`;
  bottomPipe.style.left = `${gameArea.clientWidth}px`;
  bottomPipe.style.bottom = `${physics.groundHeight}px`;

  pipeLayer.append(topPipe, bottomPipe);

  state.pipes.push({
    x: gameArea.clientWidth,
    topHeight,
    bottomHeight,
    passed: false,
    topElement: topPipe,
    bottomElement: bottomPipe,
  });
}

function getBirdRect() {
  return {
    left: gameArea.clientWidth * 0.2,
    right: gameArea.clientWidth * 0.2 + bird.offsetWidth,
    top: state.birdY,
    bottom: state.birdY + getBirdHeight(),
  };
}

function checkCollision() {
  const birdRect = getBirdRect();
  const playableHeight = getAreaHeight() - physics.groundHeight;

  if (birdRect.top <= 0 || birdRect.bottom >= playableHeight) {
    return true;
  }

  for (const pipePair of state.pipes) {
    const pipeLeft = pipePair.x;
    const pipeRight = pipePair.x + physics.pipeWidth;
    const overlapsX = birdRect.right > pipeLeft && birdRect.left < pipeRight;
    const hitsTopPipe = birdRect.top < pipePair.topHeight;
    const hitsBottomPipe = birdRect.bottom > playableHeight - pipePair.bottomHeight;

    if (overlapsX && (hitsTopPipe || hitsBottomPipe)) {
      return true;
    }
  }

  return false;
}

function flap() {
  if (!state.gameStarted) {
    startGame();
    return;
  }

  if (state.gameOver) {
    return;
  }

  state.birdVelocity = physics.jumpForce;
  triggerFlapAnimation();
  playJumpSound();
}

function endGame() {
  state.gameOver = true;
  cancelAnimationFrame(state.animationFrameId);
  triggerCollisionFeedback();
  playGameOverSound();
  showGameOverScreen();

  if (window.ArcadeLeaderboard) {
    window.ArcadeLeaderboard.submitScore(state.score);
  }
}

function gameLoop(timestamp) {
  if (!state.gameStarted || state.gameOver) {
    return;
  }

  if (!state.lastFrameTime) {
    state.lastFrameTime = timestamp;
  }

  const deltaFactor = Math.min(2, (timestamp - state.lastFrameTime) / (1000 / 60));

  if (timestamp - state.lastPipeTime > physics.pipeInterval) {
    createPipePair();
    state.lastPipeTime = timestamp;
  }

  state.birdVelocity += physics.gravity * deltaFactor;
  state.birdY += state.birdVelocity * deltaFactor;
  setBirdPosition();
  setBirdRotation();

  for (let index = state.pipes.length - 1; index >= 0; index -= 1) {
    const pipePair = state.pipes[index];
    pipePair.x -= physics.pipeSpeed * deltaFactor;
    pipePair.topElement.style.left = `${pipePair.x}px`;
    pipePair.bottomElement.style.left = `${pipePair.x}px`;

    if (!pipePair.passed && pipePair.x + physics.pipeWidth < gameArea.clientWidth * 0.2) {
      pipePair.passed = true;
      updateScore(state.score + 1);
    }

    if (pipePair.x + physics.pipeWidth < -10) {
      pipePair.topElement.remove();
      pipePair.bottomElement.remove();
      state.pipes.splice(index, 1);
    }
  }

  if (checkCollision()) {
    endGame();
    return;
  }

  state.lastFrameTime = timestamp;
  state.animationFrameId = requestAnimationFrame(gameLoop);
}

function resetGame() {
  if (window.ArcadeLeaderboard) {
    window.ArcadeLeaderboard.startRun();
  }

  cancelAnimationFrame(state.animationFrameId);
  syncGroundHeight();
  clearPipes();
  updateScore(0);
  state.gameOver = false;
  state.gameStarted = false;
  state.lastFrameTime = 0;
  state.lastPipeTime = 0;
  resetBird();
  hideGameOverScreen();
  showStartScreen();
}

function restartGame() {
  if (window.ArcadeLeaderboard) {
    window.ArcadeLeaderboard.startRun();
  }

  ensureAudioReady();
  cancelAnimationFrame(state.animationFrameId);
  syncGroundHeight();
  clearPipes();
  updateScore(0);
  state.gameOver = false;
  state.gameStarted = true;
  state.lastFrameTime = 0;
  state.lastPipeTime = performance.now();
  resetBird();
  hideStartScreen();
  hideGameOverScreen();
  state.birdVelocity = physics.jumpForce;
  triggerFlapAnimation();
  playJumpSound();
  state.animationFrameId = requestAnimationFrame(gameLoop);
  gameArea.focus();
}

function startGame() {
  if (window.ArcadeLeaderboard) {
    window.ArcadeLeaderboard.startRun();
  }

  ensureAudioReady();
  hideStartScreen();
  hideGameOverScreen();
  clearPipes();
  updateScore(0);
  state.gameStarted = true;
  state.gameOver = false;
  state.lastFrameTime = 0;
  state.lastPipeTime = performance.now();
  resetBird();
  state.birdVelocity = physics.jumpForce;
  triggerFlapAnimation();
  playJumpSound();
  state.animationFrameId = requestAnimationFrame(gameLoop);
  gameArea.focus();
}

function handlePointerInput(event) {
  if (event.target.closest("button")) {
    return;
  }

  event.preventDefault();
  ensureAudioReady();
  flap();
}

function handleKeyboardInput(event) {
  if (event.code !== "Space") {
    return;
  }

  event.preventDefault();
  ensureAudioReady();

  if (!state.gameStarted || !state.gameOver) {
    flap();
    return;
  }

  restartGame();
}

function handleResize() {
  syncGroundHeight();

  if (!state.gameStarted) {
    resetBird();
  }
}

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", restartGame);
gameArea.addEventListener("pointerdown", handlePointerInput);
document.addEventListener("keydown", handleKeyboardInput);
window.addEventListener("resize", handleResize);

if (window.ArcadeLeaderboard) {
  window.ArcadeLeaderboard.configure({
    game: "Flappy Bird"
  });
}

syncGroundHeight();
resetBird();
