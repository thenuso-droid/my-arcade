const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreValue = document.getElementById("scoreValue");
const highScoreValue = document.getElementById("highScoreValue");
const restartButton = document.getElementById("restartButton");
const overlay = document.getElementById("overlay");
const overlayTag = document.getElementById("overlayTag");
const overlayTitle = document.getElementById("overlayTitle");
const overlayMessage = document.getElementById("overlayMessage");
const overlayButton = document.getElementById("overlayButton");

const HIGH_SCORE_KEY = "geometry-dash-high-score";
const config = {
  gravity: 0.85,
  jumpForce: -13.8,
  groundHeight: 72,
  obstacleWidth: 36,
  obstacleMinHeight: 32,
  obstacleMaxHeight: 86,
  obstacleGap: 265,
  initialSpeed: 5.3,
  speedRamp: 0.0009
};

let animationFrameId = null;
let highScore = readHighScore();

const state = {
  running: false,
  gameOver: false,
  score: 0,
  distance: 0,
  speed: config.initialSpeed,
  lastTimestamp: 0,
  obstacleTimer: 0,
  player: {
    x: 140,
    y: 0,
    size: 38,
    velocityY: 0,
    rotation: 0,
    grounded: true
  },
  obstacles: []
};

function readHighScore() {
  try {
    return Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
  } catch (error) {
    return 0;
  }
}

function writeHighScore(nextHighScore) {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(nextHighScore));
  } catch (error) {
    // Ignore storage issues so gameplay still works.
  }
}

function getGroundY() {
  return canvas.height - config.groundHeight;
}

function updateStats() {
  scoreValue.textContent = String(state.score);
  highScoreValue.textContent = String(highScore);
}

function showOverlay(tag, title, message, buttonLabel) {
  overlayTag.textContent = tag;
  overlayTitle.textContent = title;
  overlayMessage.textContent = message;
  overlayButton.textContent = buttonLabel;
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function createObstacle() {
  const heightRange = config.obstacleMaxHeight - config.obstacleMinHeight;
  const height = config.obstacleMinHeight + Math.random() * heightRange;

  state.obstacles.push({
    x: canvas.width + config.obstacleWidth,
    width: config.obstacleWidth,
    height,
    passed: false
  });
}

function resetGame() {
  state.running = false;
  state.gameOver = false;
  state.score = 0;
  state.distance = 0;
  state.speed = config.initialSpeed;
  state.lastTimestamp = 0;
  state.obstacleTimer = 0;
  state.obstacles = [];
  state.player.y = getGroundY() - state.player.size;
  state.player.velocityY = 0;
  state.player.rotation = 0;
  state.player.grounded = true;
  updateStats();
  draw();
  showOverlay(
    "Tap To Start",
    "Neon Cube",
    "Tap, click, or press space to jump over the obstacles.",
    "Start Game"
  );
}

function startGame() {
  if (state.running) {
    return;
  }

  if (state.gameOver) {
    resetGame();
  }

  state.running = true;
  state.lastTimestamp = 0;
  hideOverlay();
}

function jump() {
  if (!state.running) {
    startGame();
    return;
  }

  if (!state.player.grounded || state.gameOver) {
    return;
  }

  state.player.velocityY = config.jumpForce;
  state.player.grounded = false;
}

function endGame() {
  state.running = false;
  state.gameOver = true;

  if (state.score > highScore) {
    highScore = state.score;
    writeHighScore(highScore);
  }

  updateStats();
  showOverlay(
    "Game Over",
    "Run Ended",
    `Score: ${state.score}. High score: ${highScore}. Restart and try again.`,
    "Play Again"
  );
}

function updatePlayer(deltaFactor) {
  state.player.velocityY += config.gravity * deltaFactor;
  state.player.y += state.player.velocityY * deltaFactor;
  state.player.rotation = Math.min(0.7, state.player.rotation + 0.05 * deltaFactor);

  const groundY = getGroundY() - state.player.size;

  if (state.player.y >= groundY) {
    state.player.y = groundY;
    state.player.velocityY = 0;
    state.player.rotation = 0;
    state.player.grounded = true;
  }
}

function updateObstacles(deltaFactor) {
  state.obstacleTimer += deltaFactor;

  if (state.obstacleTimer >= config.obstacleGap / state.speed) {
    state.obstacleTimer = 0;
    createObstacle();
  }

  for (let index = state.obstacles.length - 1; index >= 0; index -= 1) {
    const obstacle = state.obstacles[index];
    obstacle.x -= state.speed * deltaFactor;

    if (!obstacle.passed && obstacle.x + obstacle.width < state.player.x) {
      obstacle.passed = true;
    }

    if (obstacle.x + obstacle.width < -20) {
      state.obstacles.splice(index, 1);
    }
  }
}

function updateScore(deltaFactor) {
  state.distance += state.speed * deltaFactor;
  state.score = Math.floor(state.distance / 10);
  state.speed += config.speedRamp * deltaFactor;
  updateStats();
}

function checkCollision() {
  const playerLeft = state.player.x + 4;
  const playerRight = state.player.x + state.player.size - 4;
  const playerTop = state.player.y + 4;
  const playerBottom = state.player.y + state.player.size - 4;
  const groundY = getGroundY();

  for (const obstacle of state.obstacles) {
    const obstacleTop = groundY - obstacle.height;
    const overlaps =
      playerRight > obstacle.x &&
      playerLeft < obstacle.x + obstacle.width &&
      playerBottom > obstacleTop &&
      playerTop < groundY;

    if (overlaps) {
      return true;
    }
  }

  return false;
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#0b1730");
  gradient.addColorStop(0.55, "#0a1430");
  gradient.addColorStop(1, "#08111f");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(49, 233, 255, 0.08)";
  ctx.beginPath();
  ctx.arc(canvas.width * 0.18, canvas.height * 0.18, 120, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
}

function drawGround() {
  const groundY = getGroundY();
  ctx.fillStyle = "#101e3a";
  ctx.fillRect(0, groundY, canvas.width, config.groundHeight);

  ctx.strokeStyle = "#31e9ff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(canvas.width, groundY);
  ctx.stroke();
}

function drawPlayer() {
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
    ctx.fillStyle = "#ff4d9a";
    ctx.beginPath();
    ctx.moveTo(obstacle.x, groundY);
    ctx.lineTo(obstacle.x + obstacle.width / 2, groundY - obstacle.height);
    ctx.lineTo(obstacle.x + obstacle.width, groundY);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function draw() {
  drawBackground();
  drawGround();
  drawObstacles();
  drawPlayer();
}

function gameLoop(timestamp) {
  if (!state.running) {
    animationFrameId = window.requestAnimationFrame(gameLoop);
    return;
  }

  if (!state.lastTimestamp) {
    state.lastTimestamp = timestamp;
  }

  const deltaFactor = Math.min(2.2, (timestamp - state.lastTimestamp) / (1000 / 60));
  state.lastTimestamp = timestamp;

  updatePlayer(deltaFactor);
  updateObstacles(deltaFactor);
  updateScore(deltaFactor);
  draw();

  if (checkCollision()) {
    endGame();
  }

  animationFrameId = window.requestAnimationFrame(gameLoop);
}

function handlePointerInput(event) {
  if (event.target.closest("button")) {
    return;
  }

  event.preventDefault();
  jump();
}

function handleKeyboardInput(event) {
  if (event.code !== "Space") {
    return;
  }

  event.preventDefault();
  jump();
}

restartButton.addEventListener("click", resetGame);
overlayButton.addEventListener("click", () => {
  if (state.gameOver) {
    resetGame();
  }
  startGame();
});
canvas.addEventListener("pointerdown", handlePointerInput);
document.addEventListener("keydown", handleKeyboardInput);

resetGame();
animationFrameId = window.requestAnimationFrame(gameLoop);
