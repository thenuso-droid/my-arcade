(function () {
  const PLAYER_NAME_KEY = "arcadePlayerName";
  const LEGACY_PLAYER_NAME_KEY = "arcade-player-name";

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
    statusElement: null,
    playerNameElement: null,
    changeNameButton: null
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

  function readPlayerName() {
    try {
      const currentName = sanitizeName(window.localStorage.getItem(PLAYER_NAME_KEY) || "");

      if (currentName) {
        return currentName;
      }

      const legacyName = sanitizeName(window.localStorage.getItem(LEGACY_PLAYER_NAME_KEY) || "");

      if (legacyName) {
        window.localStorage.setItem(PLAYER_NAME_KEY, legacyName);
        window.localStorage.removeItem(LEGACY_PLAYER_NAME_KEY);
      }

      return legacyName;
    } catch (error) {
      return "";
    }
  }

  function writePlayerName(name) {
    try {
      window.localStorage.setItem(PLAYER_NAME_KEY, sanitizeName(name));
    } catch (error) {
      // Ignore storage issues so score submission can still continue.
    }
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

  function updatePlayerNameDisplay() {
    if (!state.playerNameElement) {
      return;
    }

    const savedName = readPlayerName();
    state.playerNameElement.textContent = savedName
      ? `Playing as: ${savedName}`
      : "Playing as: Guest";
  }

  function requestPlayerName(forcePrompt) {
    const savedName = readPlayerName();

    if (savedName && !forcePrompt) {
      return savedName;
    }

    const promptMessage = forcePrompt
      ? "Enter a new leaderboard name:"
      : "Enter your name for the leaderboard:";
    const enteredName = window.prompt(promptMessage, savedName);

    if (enteredName === null) {
      return null;
    }

    const nextName = sanitizeName(enteredName);

    if (!nextName) {
      return "";
    }

    writePlayerName(nextName);
    updatePlayerNameDisplay();
    return nextName;
  }

  function handleChangeName() {
    const nextName = requestPlayerName(true);

    if (nextName === null) {
      setStatus("Kept your current leaderboard name.", "neutral");
      return;
    }

    if (!nextName) {
      setStatus("Enter at least one character for your player name.", "error");
      return;
    }

    setStatus(`Saved player name as ${nextName}.`, "ready");
  }

  function ensurePlayerControls() {
    if (!state.statusElement) {
      return;
    }

    const panel = state.statusElement.closest(".leaderboard-panel");
    if (!panel) {
      return;
    }

    let controls = panel.querySelector(".leaderboard-player-controls");

    if (!controls) {
      controls = document.createElement("div");
      controls.className = "leaderboard-player-controls";

      const nameElement = document.createElement("p");
      nameElement.className = "leaderboard-player-name";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "leaderboard-name-button";
      button.textContent = "Change Name";
      button.addEventListener("click", handleChangeName);

      controls.append(nameElement, button);
      state.statusElement.insertAdjacentElement("afterend", controls);
    }

    state.playerNameElement = controls.querySelector(".leaderboard-player-name");
    state.changeNameButton = controls.querySelector(".leaderboard-name-button");
    updatePlayerNameDisplay();
  }

  function renderRows(entries) {
    if (!state.tableBody) {
      return;
    }

    if (!entries.length) {
      state.tableBody.innerHTML = "";
      setStatus("No scores yet — be the first!", "empty");
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

  function logFirebaseError(action, error) {
    const code = error && error.code ? error.code : "unknown";
    const message = error && error.message ? error.message : String(error);

    console.group(`[ArcadeLeaderboard] ${action} failed`);
    console.error("Firebase error object:", error);
    console.error("Error code:", code);
    console.error("Error message:", message);

    if (error && error.stack) {
      console.error("Stack trace:", error.stack);
    }

    console.groupEnd();
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
      logFirebaseError("Load leaderboard", error);
      if (state.tableBody) {
        state.tableBody.innerHTML = "";
      }
      setStatus("Leaderboard unavailable right now.", "error");
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

    const name = requestPlayerName(false);

    if (name === null) {
      setStatus("Score not submitted this run.", "neutral");
      return false;
    }

    if (!name) {
      setStatus("Enter a name to join the leaderboard.", "neutral");
      return false;
    }

    state.submitLock = true;

    try {
      const db = ensureFirestore();
      const existingScores = await db
        .collection("leaderboards")
        .where("game", "==", state.game)
        .where("name", "==", name)
        .get();

      const now = Date.now();
      let statusMessage = "Score submitted. Refreshing Top 10...";

      if (existingScores.empty) {
        await db.collection("leaderboards").add({
          game: state.game,
          name,
          score: finalScore,
          timestamp: now
        });
      } else {
        let primaryDoc = existingScores.docs[0];
        let bestSavedScore = Number(primaryDoc.data().score || 0);
        let bestSavedTimestamp = Number(primaryDoc.data().timestamp || 0);

        existingScores.docs.forEach((doc) => {
          const data = doc.data();
          const savedScore = Number(data.score || 0);
          const savedTimestamp = Number(data.timestamp || 0);

          if (
            savedScore > bestSavedScore ||
            (savedScore === bestSavedScore && savedTimestamp > bestSavedTimestamp)
          ) {
            primaryDoc = doc;
            bestSavedScore = savedScore;
            bestSavedTimestamp = savedTimestamp;
          }
        });

        const duplicateDocs = existingScores.docs.filter((doc) => doc.id !== primaryDoc.id);

        if (finalScore > bestSavedScore || duplicateDocs.length > 0) {
          const batch = db.batch();

          if (finalScore > bestSavedScore) {
            batch.set(
              primaryDoc.ref,
              {
                game: state.game,
                name,
                score: finalScore,
                timestamp: now
              },
              { merge: true }
            );
            statusMessage = "New best score saved. Refreshing Top 10...";
          } else {
            statusMessage = "Best score already saved. Refreshing Top 10...";
          }

          duplicateDocs.forEach((doc) => {
            batch.delete(doc.ref);
          });

          await batch.commit();
        } else {
          statusMessage = "Best score already saved. Refreshing Top 10...";
        }
      }

      setStatus(statusMessage, "ready");
      await loadScores();
      return true;
    } catch (error) {
      logFirebaseError("Submit score", error);
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
    ensurePlayerControls();

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
