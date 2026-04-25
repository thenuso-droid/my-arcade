const boardElement = document.getElementById("board");
const scoreValue = document.getElementById("scoreValue");
const highScoreValue = document.getElementById("highScoreValue");
const restartButton = document.getElementById("restartButton");
const overlay = document.getElementById("overlay");
const overlayTag = document.getElementById("overlayTag");
const overlayTitle = document.getElementById("overlayTitle");
const overlayMessage = document.getElementById("overlayMessage");
const overlayRestartButton = document.getElementById("overlayRestartButton");
const continueButton = document.getElementById("continueButton");

const SIZE = 4;
const HIGH_SCORE_KEY = "2048-high-score";

let board = createEmptyBoard();
let score = 0;
let highScore = readHighScore();
let gameOver = false;
let hasWon = false;
let keepPlaying = false;
let touchStartX = 0;
let touchStartY = 0;

function createEmptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

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
    // Ignore storage issues so the game remains playable.
  }
}

function updateHighScore() {
  if (score > highScore) {
    highScore = score;
    writeHighScore(highScore);
  }
}

function updateStats() {
  scoreValue.textContent = String(score);
  highScoreValue.textContent = String(highScore);
}

function getEmptyCells() {
  const emptyCells = [];

  for (let row = 0; row < SIZE; row += 1) {
    for (let column = 0; column < SIZE; column += 1) {
      if (board[row][column] === 0) {
        emptyCells.push({ row, column });
      }
    }
  }

  return emptyCells;
}

function addRandomTile() {
  const emptyCells = getEmptyCells();

  if (emptyCells.length === 0) {
    return;
  }

  const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  board[randomCell.row][randomCell.column] = Math.random() < 0.9 ? 2 : 4;
}

function renderBoard() {
  boardElement.innerHTML = "";

  board.flat().forEach((value) => {
    const cell = document.createElement("div");
    cell.className = "cell";

    if (value === 0) {
      cell.classList.add("cell-empty");
      cell.textContent = "";
    } else {
      cell.textContent = String(value);
      cell.classList.add(value > 2048 ? "tile-super" : `tile-${value}`);
    }

    boardElement.appendChild(cell);
  });

  updateStats();
}

function resetGame() {
  if (window.ArcadeLeaderboard) {
    window.ArcadeLeaderboard.startRun();
  }

  board = createEmptyBoard();
  score = 0;
  gameOver = false;
  hasWon = false;
  keepPlaying = false;
  hideOverlay();
  addRandomTile();
  addRandomTile();
  updateStats();
  renderBoard();
}

function showOverlay(tag, title, message, showContinue = false) {
  overlayTag.textContent = tag;
  overlayTitle.textContent = title;
  overlayMessage.textContent = message;
  continueButton.classList.toggle("hidden", !showContinue);
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function slideAndMergeLine(line) {
  const filtered = line.filter((value) => value !== 0);
  const merged = [];
  let gainedScore = 0;

  for (let index = 0; index < filtered.length; index += 1) {
    const currentValue = filtered[index];
    const nextValue = filtered[index + 1];

    if (currentValue === nextValue) {
      const mergedValue = currentValue * 2;
      merged.push(mergedValue);
      gainedScore += mergedValue;
      index += 1;
    } else {
      merged.push(currentValue);
    }
  }

  while (merged.length < SIZE) {
    merged.push(0);
  }

  return { line: merged, gainedScore };
}

function transpose(matrix) {
  return matrix[0].map((_, columnIndex) => matrix.map((row) => row[columnIndex]));
}

function reverseRows(matrix) {
  return matrix.map((row) => [...row].reverse());
}

function boardsMatch(firstBoard, secondBoard) {
  return firstBoard.every((row, rowIndex) =>
    row.every((value, columnIndex) => value === secondBoard[rowIndex][columnIndex])
  );
}

function moveLeft() {
  const nextBoard = [];
  let gainedScore = 0;

  board.forEach((row) => {
    const result = slideAndMergeLine(row);
    nextBoard.push(result.line);
    gainedScore += result.gainedScore;
  });

  return { nextBoard, gainedScore };
}

function move(direction) {
  if (gameOver || (hasWon && !keepPlaying)) {
    return;
  }

  const originalBoard = board.map((row) => [...row]);
  let workingBoard = board.map((row) => [...row]);

  if (direction === "right") {
    workingBoard = reverseRows(workingBoard);
  } else if (direction === "up") {
    workingBoard = transpose(workingBoard);
  } else if (direction === "down") {
    workingBoard = reverseRows(transpose(workingBoard));
  }

  board = workingBoard;
  const { nextBoard, gainedScore } = moveLeft();
  board = nextBoard;

  if (direction === "right") {
    board = reverseRows(board);
  } else if (direction === "up") {
    board = transpose(board);
  } else if (direction === "down") {
    board = transpose(reverseRows(board));
  }

  if (boardsMatch(originalBoard, board)) {
    board = originalBoard;
    return;
  }

  score += gainedScore;
  updateHighScore();
  addRandomTile();
  renderBoard();
  checkGameState();
}

function hasMovesAvailable() {
  if (getEmptyCells().length > 0) {
    return true;
  }

  for (let row = 0; row < SIZE; row += 1) {
    for (let column = 0; column < SIZE; column += 1) {
      const currentValue = board[row][column];
      const rightValue = board[row][column + 1];
      const downValue = board[row + 1]?.[column];

      if (currentValue === rightValue || currentValue === downValue) {
        return true;
      }
    }
  }

  return false;
}

function checkGameState() {
  const flattenedBoard = board.flat();

  if (!hasWon && flattenedBoard.includes(2048)) {
    hasWon = true;
    showOverlay(
      "Nice Work",
      "You Reached 2048",
      `Score: ${score}. You can keep playing or start a fresh round.`,
      true
    );
    return;
  }

  if (!hasMovesAvailable()) {
    gameOver = true;
    showOverlay(
      "Game Over",
      "No Moves Left",
      `Final score: ${score}. High score: ${highScore}. Restart to try again.`
    );

    if (window.ArcadeLeaderboard) {
      window.ArcadeLeaderboard.submitScore(score);
    }
  }
}

function handleKeydown(event) {
  const directions = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down"
  };

  const direction = directions[event.key];

  if (!direction) {
    return;
  }

  event.preventDefault();
  move(direction);
}

function handleTouchStart(event) {
  const touch = event.changedTouches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
}

function handleTouchEnd(event) {
  const touch = event.changedTouches[0];
  const deltaX = touch.clientX - touchStartX;
  const deltaY = touch.clientY - touchStartY;
  const minimumSwipeDistance = 24;

  if (
    Math.abs(deltaX) < minimumSwipeDistance &&
    Math.abs(deltaY) < minimumSwipeDistance
  ) {
    return;
  }

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    move(deltaX > 0 ? "right" : "left");
  } else {
    move(deltaY > 0 ? "down" : "up");
  }
}

restartButton.addEventListener("click", resetGame);
overlayRestartButton.addEventListener("click", resetGame);
continueButton.addEventListener("click", () => {
  keepPlaying = true;
  hideOverlay();
});
document.addEventListener("keydown", handleKeydown);
boardElement.addEventListener("touchstart", handleTouchStart, { passive: true });
boardElement.addEventListener("touchend", handleTouchEnd, { passive: true });

if (window.ArcadeLeaderboard) {
  window.ArcadeLeaderboard.configure({
    game: "2048"
  });
}

resetGame();
