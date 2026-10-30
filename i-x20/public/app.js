const startMenu = document.querySelector('#start-menu');
const lobby = document.querySelector('#lobby');
const game = document.querySelector('#game');
const nameField = document.querySelector('#player-name');
const toast = document.querySelector('#toast');
const passButton = document.querySelector('#pass-card');
let chosenCard;
let setupMode = 'host';

function showToast(message) {
  toast.textContent = message;
  toast.style.display = 'block';
  setTimeout(() => toast.style.display = 'none', 2200);
}

function openGame() {
  if (!nameField.value.trim()) return showToast('Enter your name first.');
  lobby.hidden = true;
  game.hidden = false;
}

document.querySelector('#open-lobby').addEventListener('click', () => {
  startMenu.classList.add('leaving');
  setTimeout(() => window.location.href = 'setup.html', 360);
});
document.querySelector('#back-to-menu').addEventListener('click', () => { lobby.hidden = true; startMenu.hidden = false; });
document.querySelector('#show-rules').addEventListener('click', () => document.querySelector('#rules-popover').hidden = false);
document.querySelector('#close-rules').addEventListener('click', () => document.querySelector('#rules-popover').hidden = true);
document.querySelectorAll('[data-choice]').forEach(choice => choice.addEventListener('click', () => {
  setupMode = choice.dataset.choice;
  document.querySelectorAll('[data-choice]').forEach(item => item.classList.toggle('active', item === choice));
  document.querySelector('#host-options').hidden = setupMode !== 'host';
  document.querySelector('#join-options').hidden = setupMode !== 'join';
  document.querySelector('#create-room').innerHTML = setupMode === 'host' ? 'CREATE PRIVATE ROOM <span>→</span>' : 'JOIN PRIVATE ROOM <span>→</span>';
}));
document.querySelectorAll('[data-count]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-count]').forEach(item => item.classList.toggle('active', item === button));
  document.querySelector('#count-label').textContent = button.dataset.count;
}));
document.querySelector('#create-room').addEventListener('click', () => {
  if (setupMode === 'join' && !document.querySelector('#private-code').value.trim()) return showToast('Enter your friend’s room code.');
  openGame();
});
document.querySelector('#back-to-lobby').addEventListener('click', () => { game.hidden = true; lobby.hidden = false; });

document.querySelectorAll('.card').forEach(card => card.addEventListener('click', () => {
  document.querySelectorAll('.card').forEach(item => item.classList.remove('selected'));
  card.classList.add('selected');
  chosenCard = card.dataset.card;
  passButton.disabled = false;
  passButton.textContent = `Pass ${chosenCard} →`;
}));

passButton.addEventListener('click', () => showToast(`${chosenCard} passed to Anika — multiplayer will be added next.`));
document.querySelector('#junction').addEventListener('click', () => showToast('JUNCTION! This button will validate your four matching cards later.'));
