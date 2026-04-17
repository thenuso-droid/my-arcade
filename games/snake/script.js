const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const touchButtons = document.querySelectorAll(".touch-button");
const currentScoreValue = document.getElementById("currentScoreValue");
const highScoreValue = document.getElementById("highScoreValue");

const tileSize = 20;
const tileCount = canvas.width / tileSize;
const gameSpeed = 140;
const pointsPerSnitch = 10;
const HIGH_SCORE_KEY = "snake-high-score";

let snake = [
  { x: 10, y: 10 },
  { x: 9, y: 10 },
  { x: 8, y: 10 }
];

let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let goldenSnitch = spawnGoldenSnitch();
let score = 0;
let gameOver = false;
let touchStartX = 0;
let touchStartY = 0;
let messageTimer = 0;
let audioContext;
let highScore = readHighScore();

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
    // Ignore storage issues so gameplay still runs.
  }
}

function updateScoreDisplay() {
  currentScoreValue.textContent = String(score);
  highScoreValue.textContent = String(highScore);
}

document.addEventListener("keydown", changeDirection);
canvas.addEventListener("touchstart", handleTouchStart, { passive: true });
canvas.addEventListener("touchend", handleTouchEnd, { passive: true });
touchButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setDirection(button.dataset.direction);
  });
});

drawGame();
updateScoreDisplay();
const gameLoop = setInterval(updateGame, gameSpeed);

function updateGame() {
  if (gameOver) {
    clearInterval(gameLoop);
    drawGame();
    drawGameOver();
    return;
  }

  direction = nextDirection;

  const head = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y
  };

  wrapPosition(head);

  if (hitSelf(head)) {
    gameOver = true;
    if (score > highScore) {
      highScore = score;
      writeHighScore(highScore);
    }
    updateScoreDisplay();
    drawGame();
    drawGameOver();

    if (window.ArcadeLeaderboard) {
      window.ArcadeLeaderboard.submitScore(score);
    }
    return;
  }

  snake.unshift(head);

  if (head.x === goldenSnitch.x && head.y === goldenSnitch.y) {
    score += pointsPerSnitch;
    goldenSnitch = spawnGoldenSnitch();
    messageTimer = 12;
    playSnitchSound();
    updateScoreDisplay();
  } else {
    snake.pop();
  }

  drawGame();
}

function drawGame() {
  drawBackground();
  drawScore();
  drawGoldenSnitch();
  drawSnake();
  drawPickupMessage();
}

function drawBackground() {
  ctx.fillStyle = "#05070d";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(212, 175, 55, 0.08)";
  for (let i = 0; i <= tileCount; i += 1) {
    const linePosition = i * tileSize;

    ctx.beginPath();
    ctx.moveTo(linePosition, 0);
    ctx.lineTo(linePosition, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, linePosition);
    ctx.lineTo(canvas.width, linePosition);
    ctx.stroke();
  }
}

function drawScore() {
  ctx.fillStyle = "#d4af37";
  ctx.font = "20px Georgia";
  ctx.textAlign = "left";
  ctx.fillText("House Points: " + score, 12, 28);
}

function drawSnake() {
  for (let i = 0; i < snake.length; i += 1) {
    const part = snake[i];

    ctx.fillStyle = i === 0 ? "#3cb371" : "#2e8b57";
    ctx.fillRect(
      part.x * tileSize + 1,
      part.y * tileSize + 1,
      tileSize - 2,
      tileSize - 2
    );
  }
}

function drawGoldenSnitch() {
  const snitchX = goldenSnitch.x * tileSize + tileSize / 2;
  const snitchY = goldenSnitch.y * tileSize + tileSize / 2;

  ctx.fillStyle = "#d4af37";
  ctx.beginPath();
  ctx.arc(snitchX, snitchY, tileSize / 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#f5deb3";
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(snitchX - 12, snitchY);
  ctx.lineTo(snitchX - 4, snitchY - 6);
  ctx.lineTo(snitchX - 4, snitchY + 6);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(snitchX + 12, snitchY);
  ctx.lineTo(snitchX + 4, snitchY - 6);
  ctx.lineTo(snitchX + 4, snitchY + 6);
  ctx.closePath();
  ctx.stroke();
}

function drawGameOver() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#d4af37";
  ctx.font = "28px Georgia";
  ctx.textAlign = "center";
  ctx.fillText(
    "Game Over - Return to Hogwarts",
    canvas.width / 2,
    canvas.height / 2 - 10
  );

  ctx.font = "18px Georgia";
  ctx.fillText(
    "Final House Points: " + score,
    canvas.width / 2,
    canvas.height / 2 + 24
  );

  ctx.font = "16px Georgia";
  ctx.fillText(
    "High Score: " + highScore,
    canvas.width / 2,
    canvas.height / 2 + 52
  );
}

function drawPickupMessage() {
  if (messageTimer <= 0) {
    return;
  }

  ctx.fillStyle = "#f5deb3";
  ctx.font = "18px Georgia";
  ctx.textAlign = "center";
  ctx.fillText("10 Points to Gryffindor!", canvas.width / 2, 54);
  messageTimer -= 1;
}

function changeDirection(event) {
  if (event.key === "ArrowUp") {
    setDirection("up");
  }

  if (event.key === "ArrowDown") {
    setDirection("down");
  }

  if (event.key === "ArrowLeft") {
    setDirection("left");
  }

  if (event.key === "ArrowRight") {
    setDirection("right");
  }
}

function setDirection(newDirection) {
  if (newDirection === "up" && direction.y !== 1) {
    nextDirection = { x: 0, y: -1 };
  }

  if (newDirection === "down" && direction.y !== -1) {
    nextDirection = { x: 0, y: 1 };
  }

  if (newDirection === "left" && direction.x !== 1) {
    nextDirection = { x: -1, y: 0 };
  }

  if (newDirection === "right" && direction.x !== -1) {
    nextDirection = { x: 1, y: 0 };
  }
}

function handleTouchStart(event) {
  const firstTouch = event.changedTouches[0];
  touchStartX = firstTouch.clientX;
  touchStartY = firstTouch.clientY;
}

function handleTouchEnd(event) {
  const lastTouch = event.changedTouches[0];
  const deltaX = lastTouch.clientX - touchStartX;
  const deltaY = lastTouch.clientY - touchStartY;
  const minimumSwipeDistance = 20;

  if (
    Math.abs(deltaX) < minimumSwipeDistance &&
    Math.abs(deltaY) < minimumSwipeDistance
  ) {
    return;
  }

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    if (deltaX > 0) {
      setDirection("right");
    } else {
      setDirection("left");
    }
  } else if (deltaY > 0) {
    setDirection("down");
  } else {
    setDirection("up");
  }
}

function spawnGoldenSnitch() {
  let newSnitchPosition;

  do {
    newSnitchPosition = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount)
    };
  } while (snakeOnTile(newSnitchPosition));

  return newSnitchPosition;
}

function playSnitchSound() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const startTime = audioContext.currentTime;

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(660, startTime);
  oscillator.frequency.exponentialRampToValueAtTime(990, startTime + 0.12);

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.15, startTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.22);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start(startTime);
  oscillator.stop(startTime + 0.22);
}

function snakeOnTile(tile) {
  for (let i = 0; i < snake.length; i += 1) {
    if (snake[i].x === tile.x && snake[i].y === tile.y) {
      return true;
    }
  }

  return false;
}

function wrapPosition(head) {
  if (head.x < 0) {
    head.x = tileCount - 1;
  } else if (head.x >= tileCount) {
    head.x = 0;
  }

  if (head.y < 0) {
    head.y = tileCount - 1;
  } else if (head.y >= tileCount) {
    head.y = 0;
  }
}

function hitSelf(head) {
  for (let i = 0; i < snake.length; i += 1) {
    if (snake[i].x === head.x && snake[i].y === head.y) {
      return true;
    }
  }

  return false;
}

if (window.ArcadeLeaderboard) {
  window.ArcadeLeaderboard.configure({
    game: "Snake"
  });
  window.ArcadeLeaderboard.startRun();
}
