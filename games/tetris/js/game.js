const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const NEXT_BLOCK_SIZE = 32;
const BASE_DROP_INTERVAL = 850;
const MIN_DROP_INTERVAL = 140;
const LEVEL_STEP = 10;

const COLORS = {
  I: "#2ccdc1",
  O: "#ffd166",
  T: "#b388ff",
  S: "#7bdc65",
  Z: "#ff6b6b",
  J: "#5aa9ff",
  L: "#ff9f43"
};

const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  O: [
    [1, 1],
    [1, 1]
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0]
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0]
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0]
  ]
};

const gameCanvas = document.getElementById("gameCanvas");
const nextCanvas = document.getElementById("nextCanvas");
const scoreValue = document.getElementById("scoreValue");
const levelValue = document.getElementById("levelValue");
const linesValue = document.getElementById("linesValue");
const restartButton = document.getElementById("restartButton");
const overlayRestartButton = document.getElementById("overlayRestartButton");
const gameOverlay = document.getElementById("gameOverlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayMessage = document.getElementById("overlayMessage");
const touchButtons = document.querySelectorAll("[data-action]");

const context = gameCanvas.getContext("2d");
const nextContext = nextCanvas.getContext("2d");

context.scale(BLOCK_SIZE, BLOCK_SIZE);
nextContext.scale(NEXT_BLOCK_SIZE, NEXT_BLOCK_SIZE);

let board = createBoard();
let currentPiece = null;
let nextPiece = null;
let score = 0;
let level = 1;
let lines = 0;
let dropInterval = BASE_DROP_INTERVAL;
let dropCounter = 0;
let lastTime = 0;
let animationFrameId = null;
let gameOver = false;

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function cloneMatrix(matrix) {
  return matrix.map((row) => [...row]);
}

function randomPieceType() {
  const types = Object.keys(SHAPES);
  return types[Math.floor(Math.random() * types.length)];
}

function createPiece(type = randomPieceType()) {
  const matrix = cloneMatrix(SHAPES[type]);
  return {
    type,
    matrix,
    color: COLORS[type],
    x: Math.floor(COLS / 2) - Math.ceil(matrix[0].length / 2),
    y: 0
  };
}

function resetGame() {
  board = createBoard();
  score = 0;
  level = 1;
  lines = 0;
  dropInterval = BASE_DROP_INTERVAL;
  dropCounter = 0;
  lastTime = 0;
  gameOver = false;
  gameOverlay.classList.add("hidden");

  nextPiece = createPiece();
  spawnPiece();
  updateStats();
  draw();

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }

  animationFrameId = requestAnimationFrame(update);
}

function spawnPiece() {
  currentPiece = nextPiece || createPiece();
  currentPiece.x = Math.floor(COLS / 2) - Math.ceil(currentPiece.matrix[0].length / 2);
  currentPiece.y = 0;
  nextPiece = createPiece();
  drawNextPiece();

  if (collides(board, currentPiece)) {
    endGame();
  }
}

function collides(boardState, piece) {
  return piece.matrix.some((row, y) =>
    row.some((value, x) => {
      if (!value) {
        return false;
      }

      const boardX = x + piece.x;
      const boardY = y + piece.y;

      return (
        boardX < 0 ||
        boardX >= COLS ||
        boardY >= ROWS ||
        (boardY >= 0 && boardState[boardY][boardX] !== 0)
      );
    })
  );
}

function merge(boardState, piece) {
  piece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        const boardY = y + piece.y;
        if (boardY >= 0) {
          boardState[boardY][x + piece.x] = piece.color;
        }
      }
    });
  });
}

function rotateMatrix(matrix) {
  return matrix[0].map((_, index) => matrix.map((row) => row[index]).reverse());
}

function rotatePiece() {
  if (gameOver) {
    return;
  }

  const rotated = rotateMatrix(currentPiece.matrix);
  const originalX = currentPiece.x;
  const kicks = [0, -1, 1, -2, 2];

  for (const offset of kicks) {
    const rotatedPiece = {
      ...currentPiece,
      matrix: rotated,
      x: originalX + offset
    };

    if (!collides(board, rotatedPiece)) {
      currentPiece.matrix = rotated;
      currentPiece.x = rotatedPiece.x;
      draw();
      return;
    }
  }
}

function movePiece(offset) {
  if (gameOver) {
    return;
  }

  currentPiece.x += offset;
  if (collides(board, currentPiece)) {
    currentPiece.x -= offset;
    return;
  }

  draw();
}

function dropPiece() {
  if (gameOver) {
    return;
  }

  currentPiece.y += 1;

  if (collides(board, currentPiece)) {
    currentPiece.y -= 1;
    lockPiece();
    return;
  }

  dropCounter = 0;
  draw();
}

function hardDrop() {
  if (gameOver) {
    return;
  }

  while (!collides(board, currentPiece)) {
    currentPiece.y += 1;
  }

  currentPiece.y -= 1;
  lockPiece();
}

function lockPiece() {
  merge(board, currentPiece);
  clearLines();
  spawnPiece();
  updateStats();
  draw();
}

function clearLines() {
  let cleared = 0;

  for (let y = board.length - 1; y >= 0; y -= 1) {
    if (board[y].every((cell) => cell !== 0)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(0));
      cleared += 1;
      y += 1;
    }
  }

  if (!cleared) {
    return;
  }

  lines += cleared;
  score += [0, 100, 300, 500, 800][cleared] * level;
  level = Math.floor(lines / LEVEL_STEP) + 1;
  dropInterval = Math.max(MIN_DROP_INTERVAL, BASE_DROP_INTERVAL - (level - 1) * 70);
}

function drawCell(targetContext, x, y, color) {
  targetContext.fillStyle = color;
  targetContext.fillRect(x, y, 1, 1);
  targetContext.fillStyle = "rgba(255, 255, 255, 0.18)";
  targetContext.fillRect(x + 0.08, y + 0.08, 0.84, 0.16);
  targetContext.fillStyle = "rgba(0, 0, 0, 0.18)";
  targetContext.fillRect(x, y + 0.84, 1, 0.16);
}

function drawMatrix(targetContext, matrix, offset, color) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        drawCell(targetContext, x + offset.x, y + offset.y, color);
      }
    });
  });
}

function drawBoard() {
  context.fillStyle = "#102228";
  context.fillRect(0, 0, COLS, ROWS);

  board.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        drawCell(context, x, y, value);
      }
    });
  });
}

function drawGhostPiece() {
  const ghost = {
    ...currentPiece,
    y: currentPiece.y
  };

  while (!collides(board, ghost)) {
    ghost.y += 1;
  }
  ghost.y -= 1;

  ghost.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        context.strokeStyle = "rgba(255, 255, 255, 0.25)";
        context.lineWidth = 0.08;
        context.strokeRect(x + ghost.x + 0.08, y + ghost.y + 0.08, 0.84, 0.84);
      }
    });
  });
}

function drawNextPiece() {
  nextContext.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  nextContext.fillStyle = "#102228";
  nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  if (!nextPiece) {
    return;
  }

  const previewX = (5 - nextPiece.matrix[0].length) / 2;
  const previewY = (5 - nextPiece.matrix.length) / 2;
  drawMatrix(nextContext, nextPiece.matrix, { x: previewX, y: previewY }, nextPiece.color);
}

function draw() {
  drawBoard();
  if (!gameOver && currentPiece) {
    drawGhostPiece();
    drawMatrix(context, currentPiece.matrix, { x: currentPiece.x, y: currentPiece.y }, currentPiece.color);
  }
}

function updateStats() {
  scoreValue.textContent = String(score);
  levelValue.textContent = String(level);
  linesValue.textContent = String(lines);
}

function endGame() {
  gameOver = true;
  gameOverlay.classList.remove("hidden");
  overlayTitle.textContent = "Game Over";
  overlayMessage.textContent = `Final score: ${score}. Restart to try again.`;

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

function update(time = 0) {
  if (gameOver) {
    return;
  }

  const deltaTime = time - lastTime;
  lastTime = time;
  dropCounter += deltaTime;

  if (dropCounter > dropInterval) {
    dropPiece();
  }

  draw();
  animationFrameId = requestAnimationFrame(update);
}

function handleAction(action) {
  switch (action) {
    case "left":
      movePiece(-1);
      break;
    case "right":
      movePiece(1);
      break;
    case "down":
      dropPiece();
      score += gameOver ? 0 : 1;
      updateStats();
      break;
    case "rotate":
      rotatePiece();
      break;
    case "drop":
      hardDrop();
      break;
    default:
      break;
  }
}

document.addEventListener("keydown", (event) => {
  if (gameOver && event.key !== "Enter") {
    return;
  }

  const key = event.key.toLowerCase();
  const controlledKeys = ["arrowleft", "arrowright", "arrowdown", "arrowup", "x", " ", "enter"];

  if (controlledKeys.includes(key)) {
    event.preventDefault();
  }

  if (key === "arrowleft") {
    handleAction("left");
  } else if (key === "arrowright") {
    handleAction("right");
  } else if (key === "arrowdown") {
    handleAction("down");
  } else if (key === "arrowup" || key === "x") {
    handleAction("rotate");
  } else if (key === " ") {
    handleAction("drop");
  } else if (key === "enter") {
    resetGame();
  }
});

touchButtons.forEach((button) => {
  const action = button.dataset.action;

  const triggerAction = (event) => {
    event.preventDefault();
    handleAction(action);
  };

  button.addEventListener("pointerdown", triggerAction);
});

restartButton.addEventListener("click", resetGame);
overlayRestartButton.addEventListener("click", resetGame);

resetGame();
