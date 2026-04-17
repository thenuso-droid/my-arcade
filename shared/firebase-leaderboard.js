(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyBG5lasnMDOaGjSiVQC8EsLAmStXWj65BE",
    authDomain: "my-arcade-leaderboard.firebaseapp.com",
    projectId: "my-arcade-leaderboard",
    storageBucket: "my-arcade-leaderboard.firebasestorage.app",
    messagingSenderId: "5027936744",
    appId: "1:5027936744:web:5e14da2c2025edcbdfcc5d",
    measurementId: "G-41T7WXHW2X"
  };

  const state = {
    game: "",
    allowZeroScores: false,
    submitLock: false,
    tableBody: null,
    statusElement: null
  };

  let firestore = null;

  function ensureFirestore() {
    if (firestore) {
      return firestore;
    }

    if (!window.firebase || !window.firebase.firestore) {
      throw new Error("Firebase scripts are not available on this page.");
    }

    const app = window.firebase.apps.length
      ? window.firebase.app()
      : window.firebase.initializeApp(firebaseConfig);

    firestore = app.firestore();
    return firestore;
  }

  function sanitizeName(name) {
    return String(name || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 20);
  }

  function formatScore(score) {
    return Number(score || 0).toLocaleString();
  }

  function setStatus(message, tone) {
    if (!state.statusElement) {
      return;
    }

    state.statusElement.textContent = message;
    state.statusElement.dataset.tone = tone || "neutral";
  }

  function renderRows(entries) {
    if (!state.tableBody) {
      return;
    }

    if (!entries.length) {
      state.tableBody.innerHTML = "";
      setStatus("No scores yet", "empty");
      return;
    }

    const rowsHtml = entries
      .map((entry, index) => {
        return [
          "<tr>",
          `<td>${index + 1}</td>`,
          `<td>${escapeHtml(entry.name || "Player")}</td>`,
          `<td>${formatScore(entry.score)}</td>`,
          "</tr>"
        ].join("");
      })
      .join("");

    state.tableBody.innerHTML = rowsHtml;
    setStatus("Live global Top 10", "ready");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function loadScores() {
    if (!state.game) {
      return;
    }

    if (state.tableBody) {
      state.tableBody.innerHTML = "";
    }
    setStatus("Loading leaderboard...", "loading");

    try {
      const db = ensureFirestore();
      const snapshot = await db
        .collection("leaderboards")
        .where("game", "==", state.game)
        .orderBy("score", "desc")
        .orderBy("timestamp", "desc")
        .limit(10)
        .get();

      const entries = snapshot.docs.map((doc) => doc.data());
      renderRows(entries);
    } catch (error) {
      console.error("[ArcadeLeaderboard] Failed to load scores", error);
      if (state.tableBody) {
        state.tableBody.innerHTML = "";
      }
      setStatus("Leaderboard unavailable right now. Please try again later.", "error");
    }
  }

  async function submitScore(score, options) {
    const settings = options || {};
    const finalScore = Number(score || 0);
    const allowZeroScores =
      settings.allowZeroScores !== undefined ? settings.allowZeroScores : state.allowZeroScores;

    if (!state.game || state.submitLock) {
      return false;
    }

    if (!allowZeroScores && finalScore <= 0) {
      return false;
    }

    state.submitLock = true;

    const enteredName = window.prompt("Enter your name for the leaderboard:", "");
    const name = sanitizeName(enteredName);

    if (enteredName === null) {
      setStatus("Score not submitted this run.", "neutral");
      return false;
    }

    if (!name) {
      setStatus("Enter a name next time to join the leaderboard.", "neutral");
      return false;
    }

    try {
      const db = ensureFirestore();
      await db.collection("leaderboards").add({
        game: state.game,
        name,
        score: finalScore,
        timestamp: Date.now()
      });
      setStatus("Score submitted. Refreshing Top 10...", "ready");
      await loadScores();
      return true;
    } catch (error) {
      console.error("[ArcadeLeaderboard] Failed to submit score", error);
      setStatus("Could not save your score right now.", "error");
      return false;
    }
  }

  function configure(options) {
    const settings = options || {};
    state.game = settings.game || "";
    state.allowZeroScores = Boolean(settings.allowZeroScores);
    state.submitLock = false;
    state.tableBody = document.getElementById(settings.rowsId || "leaderboardRows");
    state.statusElement = document.getElementById(settings.statusId || "leaderboardStatus");

    loadScores();
  }

  function startRun() {
    state.submitLock = false;
  }

  window.ArcadeLeaderboard = {
    configure,
    loadScores,
    startRun,
    submitScore
  };
})();
