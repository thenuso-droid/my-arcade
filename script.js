const gameCards = document.querySelectorAll(".game-card");

gameCards.forEach((card, index) => {
  window.setTimeout(() => {
    card.classList.add("visible");
  }, 120 * (index + 1));
});
