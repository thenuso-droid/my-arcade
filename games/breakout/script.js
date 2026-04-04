const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreValue = document.getElementById("scoreValue");
const livesValue = document.getElementById("livesValue");
const levelValue = document.getElementById("levelValue");
const highScoreValue = document.getElementById("highScoreValue");
const statusValue = document.getElementById("statusValue");
const restartButton = document.getElementById("restartButton");
const overlay = document.getElementById("overlay");
const overlayTag = document.getElementById("overlayTag");
const overlayTitle = document.getElementById("overlayTitle");
const overlayMessage = document.getElementById("overlayMessage");
const overlayButton = document.getElementById("overlayButton");
const canvasWrap = document.querySelector(".canvas-wrap");

const config = {
  width: canvas.width,
  height: canvas.height,
  paddle: {
    width: 150,
    expandedWidth: 220,
    height: 16,
    speed: 9,
    yOffset: 34,
    expandDuration: 12000
  },
  ball: {
    radius: 10,
    startSpeed: 5.1,
    maxSpeed: 12.5,
    rampPerSecond: 0.05
  },
  bricks: {
    rows: 6,
    columns: 10,
    padding: 10,
    topOffset: 78,
    sideOffset: 26,
    height: 26
  },
  powerUps: {
    fallSpeed: 2.4,
    dropChance: 0.22,
    slowDuration: 9000,
    size: 18
  },
  particles: {
    max: 160
  },
  lives: 3
};

const brickPalette = ["#ff8a5b", "#ff5d8f", "#ffd166", "#7ae582", "#5cc8ff", "#8093f1"];
const powerUpTypes = ["expand", "multiball", "slow"];
const powerUpStyles = {
  expand: { label: "W", color: "#5cc8ff", name: "Wide Paddle" },
  multiball: { label: "M", color: "#ffd166", name: "Multi-ball" },
  slow: { label: "S", color: "#7ae582", name: "Slow Motion" }
};

let gameState;
let animationFrameId = null;
let lastTimestamp = 0;
let audioContext = null;
const HIGH_SCORE_KEY = "breakout-high-score";
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
    // Ignore storage issues so gameplay continues.
  }
}

function createBall(x, y, direction = 1, speed = config.ball.startSpeed) {
  return {
    x,
    y,
    radius: config.ball.radius,
    speed,
    vx: speed * 0.72 * direction,
    vy: -speed
  };
}

function createInitialState() {
  const paddleY = config.height - config.paddle.yOffset;
  const paddleX = config.width / 2 - config.paddle.width / 2;
  const ballX = config.width / 2;
  const ballY = paddleY - config.ball.radius - 14;

  return {
    running: false,
    isGameOver: false,
    hasStarted: false,
    score: 0,
    lives: config.lives,
    level: 1,
    keys: {
      left: false,
      right: false
    },
    paddle: {
      x: paddleX,
      y: paddleY,
      width: config.paddle.width,
      baseWidth: config.paddle.width,
      height: config.paddle.height,
      speed: config.paddle.speed,
      glow: 0
    },
    balls: [createBall(ballX, ballY)],
    bricks: buildBricks(1),
    powerUps: [],
    particles: [],
    effects: {
      shake: 0
    },
    timers: {
      expandUntil: 0,
      slowUntil: 0
    }
  };
}

function buildBricks(level) {
  const bricks = [];
  const totalPadding = config.bricks.padding * (config.bricks.columns - 1);
  const availableWidth = config.width - config.bricks.sideOffset * 2 - totalPadding;
  const brickWidth = availableWidth / config.bricks.columns;

  for (let row = 0; row < config.bricks.rows; row += 1) {
    for (let column = 0; column < config.bricks.columns; column += 1) {
      const x = config.bricks.sideOffset + column * (brickWidth + config.bricks.padding);
      const y = config.bricks.topOffset + row * (config.bricks.height + config.bricks.padding);
      const strength = row < Math.min(1 + level, 3) ? 2 : 1;

      bricks.push({
        x,
        y,
        width: brickWidth,
        height: config.bricks.height,
        strength,
        maxStrength: strength,
        color: brickPalette[row % brickPalette.length],
        points: strength * 10
      });
    }
  }

  return bricks;
}

function getCurrentBaseBallSpeed() {
  return Math.min(
    config.ball.startSpeed + (gameState.level - 1) * 0.45,
    config.ball.maxSpeed
  );
}

function getSpeedModifier() {
  return Date.now() < gameState.timers.slowUntil ? 0.72 : 1;
}

function getTargetBallSpeed() {
  return getCurrentBaseBallSpeed() * getSpeedModifier();
}

function resetBallAndPaddle() {
  gameState.paddle.width = Date.now() < gameState.timers.expandUntil ? config.paddle.expandedWidth : config.paddle.baseWidth;
  gameState.paddle.x = config.width / 2 - gameState.paddle.width / 2;

  const ballX = gameState.paddle.x + gameState.paddle.width / 2;
  const ballY = gameState.paddle.y - config.ball.radius - 14;
  const speed = getTargetBallSpeed();
  const direction = Math.random() > 0.5 ? 1 : -1;

  gameState.balls = [createBall(ballX, ballY, direction, speed)];
  gameState.powerUps = [];
}

function restartGame() {
  gameState = createInitialState();
  lastTimestamp = 0;
  canvasWrap.classList.remove("shake");
  updateHud();
  showOverlay(
    "Tap / Press to Start",
    "Breakout, Upgraded",
    "Catch power-ups, smash stronger bricks, and keep the ball alive. Use mouse, keyboard, or touch drag to move the paddle.",
    "Start Game"
  );
  draw();
}

function startGame() {
  if (!gameState.isGameOver) {
    gameState.running = true;
    gameState.hasStarted = true;
    hideOverlay();
    resumeAudio();
  }
}

function updateHud() {
  scoreValue.textContent = gameState.score;
  livesValue.textContent = gameState.lives;
  levelValue.textContent = gameState.level;
  highScoreValue.textContent = highScore;

  const statuses = [];
  if (Date.now() < gameState.timers.expandUntil) {
    statuses.push("Wide Paddle");
  }
  if (Date.now() < gameState.timers.slowUntil) {
    statuses.push("Slow Motion");
  }
  if (gameState.balls.length > 1) {
    statuses.push(`${gameState.balls.length} Balls`);
  }

  statusValue.textContent = statuses.length > 0 ? statuses.join(" • ") : "Normal";
}

function showOverlay(tag, title, message, buttonLabel) {
  overlayTag.textContent = tag;
  overlayTitle.textContent = title;
  overlayMessage.textContent = message;
  overlayButton.textContent = buttonLabel;
  overlay.classList.remove("hidden");
  overlay.classList.remove("fade-out");
}

function hideOverlay() {
  overlay.classList.add("fade-out");
  window.setTimeout(() => {
    if (gameState.running) {
      overlay.classList.add("hidden");
    }
  }, 240);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function ensureAudio() {
  if (!audioContext) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (AudioCtor) {
      audioContext = new AudioCtor();
    }
  }
}

function resumeAudio() {
  ensureAudio();
  if (audioContext && audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }
}

function playSound(type) {
  ensureAudio();

  if (!audioContext) {
    return;
  }

  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  if (type === "bounce") {
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(420, now);
    oscillator.frequency.exponentialRampToValueAtTime(240, now + 0.08);
    gainNode.gain.setValueAtTime(0.03, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
  } else if (type === "brick") {
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(250, now);
    oscillator.frequency.exponentialRampToValueAtTime(140, now + 0.12);
    gainNode.gain.setValueAtTime(0.04, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  } else if (type === "powerup") {
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(390, now);
    oscillator.frequency.linearRampToValueAtTime(620, now + 0.18);
    gainNode.gain.setValueAtTime(0.045, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  } else if (type === "lose") {
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(220, now);
    oscillator.frequency.exponentialRampToValueAtTime(80, now + 0.32);
    gainNode.gain.setValueAtTime(0.05, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
  }

  oscillator.start(now);
  oscillator.stop(now + 0.35);
}

function triggerShake() {
  gameState.effects.shake = 14;
  canvasWrap.classList.remove("shake");
  void canvasWrap.offsetWidth;
  canvasWrap.classList.add("shake");
}

function createBrickParticles(brick) {
  const burstCount = 8;

  for (let index = 0; index < burstCount; index += 1) {
    if (gameState.particles.length >= config.particles.max) {
      break;
    }

    gameState.particles.push({
      x: brick.x + brick.width / 2,
      y: brick.y + brick.height / 2,
      vx: (Math.random() - 0.5) * 4.5,
      vy: (Math.random() - 0.9) * 4.5,
      life: 24 + Math.random() * 16,
      size: 2 + Math.random() * 3,
      color: brick.color
    });
  }
}

function maybeSpawnPowerUp(brick) {
  if (Math.random() > config.powerUps.dropChance) {
    return;
  }

  const type = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];

  gameState.powerUps.push({
    type,
    x: brick.x + brick.width / 2,
    y: brick.y + brick.height / 2,
    size: config.powerUps.size,
    vy: config.powerUps.fallSpeed
  });
}

function setPaddleFromPointer(clientX) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = config.width / rect.width;
  const x = (clientX - rect.left) * scaleX;
  gameState.paddle.x = clamp(x - gameState.paddle.width / 2, 0, config.width - gameState.paddle.width);

  if (!gameState.running && !gameState.isGameOver) {
    const readyBall = gameState.balls[0];
    readyBall.x = gameState.paddle.x + gameState.paddle.width / 2;
  }
}

function updatePaddle() {
  if (gameState.keys.left) {
    gameState.paddle.x -= gameState.paddle.speed;
  }

  if (gameState.keys.right) {
    gameState.paddle.x += gameState.paddle.speed;
  }

  gameState.paddle.x = clamp(gameState.paddle.x, 0, config.width - gameState.paddle.width);
  gameState.paddle.glow = Math.max(0, gameState.paddle.glow - 0.02);

  if (!gameState.running && !gameState.isGameOver) {
    const readyBall = gameState.balls[0];
    readyBall.x = gameState.paddle.x + gameState.paddle.width / 2;
  }
}

function syncBallSpeed(ball) {
  const currentSpeed = Math.hypot(ball.vx, ball.vy) || 1;
  const scale = ball.speed / currentSpeed;
  ball.vx *= scale;
  ball.vy *= scale;
}

function syncAllBallSpeeds() {
  const targetSpeed = getTargetBallSpeed();

  for (const ball of gameState.balls) {
    ball.speed = clamp(targetSpeed, config.ball.startSpeed * 0.85, config.ball.maxSpeed);
    syncBallSpeed(ball);
  }
}

function handleWallCollisions(ball) {
  let bounced = false;

  if (ball.x + ball.radius >= config.width) {
    ball.x = config.width - ball.radius;
    ball.vx *= -1;
    bounced = true;
  } else if (ball.x - ball.radius <= 0) {
    ball.x = ball.radius;
    ball.vx *= -1;
    bounced = true;
  }

  if (ball.y - ball.radius <= 0) {
    ball.y = ball.radius;
    ball.vy *= -1;
    bounced = true;
  }

  if (bounced) {
    playSound("bounce");
  }
}

function handlePaddleCollision(ball) {
  const { paddle } = gameState;
  const hitsPaddle =
    ball.y + ball.radius >= paddle.y &&
    ball.y - ball.radius <= paddle.y + paddle.height &&
    ball.x >= paddle.x &&
    ball.x <= paddle.x + paddle.width &&
    ball.vy > 0;

  if (!hitsPaddle) {
    return;
  }

  const hitPosition = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
  const bounceAngle = hitPosition * (Math.PI / 2.9);

  ball.speed = Math.min(ball.speed + 0.12, config.ball.maxSpeed);
  ball.vx = Math.sin(bounceAngle) * ball.speed;
  ball.vy = -Math.cos(bounceAngle) * ball.speed;
  ball.y = paddle.y - ball.radius;
  gameState.paddle.glow = 1;
  playSound("bounce");
}

function applyPowerUp(type) {
  const now = Date.now();

  if (type === "expand") {
    gameState.timers.expandUntil = now + config.paddle.expandDuration;
    gameState.paddle.width = config.paddle.expandedWidth;
    gameState.paddle.x = clamp(gameState.paddle.x, 0, config.width - gameState.paddle.width);
  } else if (type === "multiball") {
    const sourceBall = gameState.balls[0];
    if (sourceBall) {
      const extraBallA = createBall(sourceBall.x, sourceBall.y, 1, sourceBall.speed);
      const extraBallB = createBall(sourceBall.x, sourceBall.y, -1, sourceBall.speed);
      extraBallA.vx = Math.abs(sourceBall.vx) || sourceBall.speed * 0.7;
      extraBallA.vy = -Math.abs(sourceBall.vy) || -sourceBall.speed;
      extraBallB.vx = -Math.abs(sourceBall.vx) || -sourceBall.speed * 0.7;
      extraBallB.vy = -Math.abs(sourceBall.vy) || -sourceBall.speed;
      gameState.balls.push(extraBallA, extraBallB);
    }
  } else if (type === "slow") {
    gameState.timers.slowUntil = now + config.powerUps.slowDuration;
    syncAllBallSpeeds();
  }

  playSound("powerup");
  updateHud();
}

function updateTimedEffects() {
  let hudChanged = false;
  const now = Date.now();

  if (now >= gameState.timers.expandUntil && gameState.paddle.width !== gameState.paddle.baseWidth) {
    const center = gameState.paddle.x + gameState.paddle.width / 2;
    gameState.paddle.width = gameState.paddle.baseWidth;
    gameState.paddle.x = clamp(center - gameState.paddle.width / 2, 0, config.width - gameState.paddle.width);
    hudChanged = true;
  }

  if (gameState.timers.slowUntil !== 0 && now >= gameState.timers.slowUntil) {
    gameState.timers.slowUntil = 0;
    syncAllBallSpeeds();
    hudChanged = true;
  }

  if (gameState.effects.shake > 0) {
    gameState.effects.shake -= 1;
  }

  if (hudChanged) {
    updateHud();
  }
}

function handleBrickCollisions(ball) {
  for (const brick of gameState.bricks) {
    if (brick.strength <= 0) {
      continue;
    }

    const overlaps =
      ball.x + ball.radius > brick.x &&
      ball.x - ball.radius < brick.x + brick.width &&
      ball.y + ball.radius > brick.y &&
      ball.y - ball.radius < brick.y + brick.height;

    if (!overlaps) {
      continue;
    }

    const overlapLeft = ball.x + ball.radius - brick.x;
    const overlapRight = brick.x + brick.width - (ball.x - ball.radius);
    const overlapTop = ball.y + ball.radius - brick.y;
    const overlapBottom = brick.y + brick.height - (ball.y - ball.radius);
    const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

    if (minOverlap === overlapLeft || minOverlap === overlapRight) {
      ball.vx *= -1;
    } else {
      ball.vy *= -1;
    }

    brick.strength -= 1;
    gameState.score += brick.points;
    ball.speed = Math.min(ball.speed + 0.08, config.ball.maxSpeed);
    syncBallSpeed(ball);
    createBrickParticles(brick);
    playSound("brick");

    if (brick.strength <= 0) {
      maybeSpawnPowerUp(brick);
    }

    if (gameState.bricks.every((item) => item.strength <= 0)) {
      gameState.level += 1;
      gameState.bricks = buildBricks(gameState.level);
      gameState.running = false;
      resetBallAndPaddle();
      updateHud();
      showOverlay(
        "Level Clear",
        `Level ${gameState.level}`,
        "The pace is picking up. Tap or press Play to jump into the next round.",
        "Next Level"
      );
    } else {
      updateHud();
    }

    return true;
  }

  return false;
}

function loseLife() {
  gameState.lives -= 1;
  gameState.running = false;
  triggerShake();
  playSound("lose");

  if (gameState.lives <= 0) {
    gameState.isGameOver = true;
    if (gameState.score > highScore) {
      highScore = gameState.score;
      writeHighScore(highScore);
    }
    updateHud();
    showOverlay(
      "Game Over",
      "Out of Lives",
      `Final score: ${gameState.score}. High score: ${highScore}. Catch more power-ups and try another run.`,
      "Play Again"
    );
    return;
  }

  resetBallAndPaddle();
  updateHud();
  showOverlay(
    "Life Lost",
    "Take Another Shot",
    `You have ${gameState.lives} ${gameState.lives === 1 ? "life" : "lives"} left. Tap or press Play when you're ready.`,
    "Continue"
  );
}

function updateBalls(deltaSeconds) {
  if (!gameState.running) {
    return;
  }

  const speedGain = config.ball.rampPerSecond * deltaSeconds;

  for (let index = gameState.balls.length - 1; index >= 0; index -= 1) {
    const ball = gameState.balls[index];
    ball.speed = Math.min(ball.speed + speedGain, config.ball.maxSpeed);
    syncBallSpeed(ball);

    ball.x += ball.vx;
    ball.y += ball.vy;

    handleWallCollisions(ball);
    handlePaddleCollision(ball);
    handleBrickCollisions(ball);

    if (ball.y - ball.radius > config.height) {
      gameState.balls.splice(index, 1);
    }
  }

  if (gameState.balls.length === 0) {
    loseLife();
  } else {
    updateHud();
  }
}

function updatePowerUps() {
  if (!gameState.running) {
    return;
  }

  const { paddle } = gameState;

  for (let index = gameState.powerUps.length - 1; index >= 0; index -= 1) {
    const powerUp = gameState.powerUps[index];
    powerUp.y += powerUp.vy;

    const caught =
      powerUp.y + powerUp.size >= paddle.y &&
      powerUp.y - powerUp.size <= paddle.y + paddle.height &&
      powerUp.x >= paddle.x &&
      powerUp.x <= paddle.x + paddle.width;

    if (caught) {
      applyPowerUp(powerUp.type);
      gameState.powerUps.splice(index, 1);
      continue;
    }

    if (powerUp.y - powerUp.size > config.height) {
      gameState.powerUps.splice(index, 1);
    }
  }
}

function updateParticles() {
  for (let index = gameState.particles.length - 1; index >= 0; index -= 1) {
    const particle = gameState.particles[index];
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += 0.03;
    particle.life -= 1;

    if (particle.life <= 0) {
      gameState.particles.splice(index, 1);
    }
  }
}

function drawBackground() {
  ctx.clearRect(0, 0, config.width, config.height);

  const gradient = ctx.createLinearGradient(0, 0, 0, config.height);
  gradient.addColorStop(0, "#06111f");
  gradient.addColorStop(0.58, "#0f2742");
  gradient.addColorStop(1, "#08101d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, config.width, config.height);

  ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
  for (let x = 0; x <= config.width; x += 48) {
    ctx.fillRect(x, 0, 1, config.height);
  }

  ctx.fillStyle = "rgba(92, 200, 255, 0.08)";
  ctx.beginPath();
  ctx.arc(config.width * 0.18, config.height * 0.14, 140, 0, Math.PI * 2);
  ctx.fill();
}

function drawPaddle() {
  const { paddle } = gameState;
  const glowStrength = 18 + paddle.glow * 18;

  ctx.save();
  ctx.shadowColor = "rgba(92, 200, 255, 0.85)";
  ctx.shadowBlur = glowStrength;
  ctx.fillStyle = "#dff4ff";
  ctx.beginPath();
  ctx.roundRect(paddle.x, paddle.y, paddle.width, paddle.height, 999);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "rgba(92, 200, 255, 0.32)";
  ctx.beginPath();
  ctx.roundRect(paddle.x + 18, paddle.y + 3, Math.max(24, paddle.width - 36), 4, 999);
  ctx.fill();
}

function drawBalls() {
  for (const ball of gameState.balls) {
    const glow = ctx.createRadialGradient(ball.x - 3, ball.y - 4, 2, ball.x, ball.y, ball.radius + 11);
    glow.addColorStop(0, "#ffffff");
    glow.addColorStop(0.35, "#8be9ff");
    glow.addColorStop(1, "rgba(92, 200, 255, 0.14)");

    ctx.save();
    ctx.shadowColor = "rgba(92, 200, 255, 0.95)";
    ctx.shadowBlur = 20;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawBricks() {
  for (const brick of gameState.bricks) {
    if (brick.strength <= 0) {
      continue;
    }

    const strengthRatio = brick.strength / brick.maxStrength;
    const alphaHex = strengthRatio > 0.5 ? "F2" : "B5";

    ctx.save();
    ctx.shadowColor = `${brick.color}55`;
    ctx.shadowBlur = 12;
    ctx.fillStyle = `${brick.color}${alphaHex}`;
    ctx.beginPath();
    ctx.roundRect(brick.x, brick.y, brick.width, brick.height, 8);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.beginPath();
    ctx.roundRect(brick.x + 8, brick.y + 5, brick.width - 16, 4, 999);
    ctx.fill();

    if (brick.strength > 1) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.font = "bold 13px Space Grotesk";
      ctx.textAlign = "center";
      ctx.fillText(`${brick.strength}`, brick.x + brick.width / 2, brick.y + brick.height / 2 + 5);
    }
  }
}

function drawParticles() {
  for (const particle of gameState.particles) {
    const alpha = clamp(particle.life / 34, 0, 1);
    ctx.fillStyle = `${particle.color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPowerUps() {
  for (const powerUp of gameState.powerUps) {
    const style = powerUpStyles[powerUp.type];

    ctx.save();
    ctx.shadowColor = `${style.color}99`;
    ctx.shadowBlur = 16;
    ctx.fillStyle = style.color;
    ctx.beginPath();
    ctx.arc(powerUp.x, powerUp.y, powerUp.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "#06111f";
    ctx.font = "bold 14px Space Grotesk";
    ctx.textAlign = "center";
    ctx.fillText(style.label, powerUp.x, powerUp.y + 5);
  }
}

function draw() {
  drawBackground();
  drawBricks();
  drawParticles();
  drawPowerUps();
  drawPaddle();
  drawBalls();
}

function gameLoop(timestamp) {
  const elapsed = timestamp - lastTimestamp;
  const delta = lastTimestamp === 0 ? 16.67 : elapsed;

  if (elapsed >= 1000 / 60 || lastTimestamp === 0) {
    lastTimestamp = timestamp;
    updatePaddle();
    updateTimedEffects();
    updateBalls(delta / 1000);
    updatePowerUps();
    updateParticles();
    draw();
  }

  animationFrameId = window.requestAnimationFrame(gameLoop);
}

function onKeyDown(event) {
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
    gameState.keys.left = true;
  }

  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
    gameState.keys.right = true;
  }

  if (event.code === "Space" || event.key === "Enter") {
    event.preventDefault();

    if (gameState.isGameOver) {
      restartGame();
      startGame();
      return;
    }

    startGame();
  }
}

function onKeyUp(event) {
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
    gameState.keys.left = false;
  }

  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
    gameState.keys.right = false;
  }
}

canvas.addEventListener("mousemove", (event) => {
  setPaddleFromPointer(event.clientX);
});

canvas.addEventListener("pointerdown", (event) => {
  setPaddleFromPointer(event.clientX);

  if (!gameState.running) {
    if (gameState.isGameOver) {
      restartGame();
    }
    startGame();
  }
});

canvas.addEventListener("touchstart", (event) => {
  const touch = event.touches[0];
  if (touch) {
    setPaddleFromPointer(touch.clientX);
  }
}, { passive: true });

canvas.addEventListener("touchmove", (event) => {
  const touch = event.touches[0];
  if (touch) {
    setPaddleFromPointer(touch.clientX);
  }
}, { passive: true });

window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);

restartButton.addEventListener("click", () => {
  restartGame();
});

overlayButton.addEventListener("click", () => {
  if (gameState.isGameOver) {
    restartGame();
  }
  startGame();
});

restartGame();

if (animationFrameId) {
  window.cancelAnimationFrame(animationFrameId);
}

animationFrameId = window.requestAnimationFrame(gameLoop);
