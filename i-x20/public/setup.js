const $ = selector => document.querySelector(selector);
let mode = 'host';
const toast = message => { $('#toast').textContent = message; $('#toast').style.display = 'block'; setTimeout(() => $('#toast').style.display = 'none', 2200); };

$('#back-to-menu').addEventListener('click', () => location.href = 'index.html');
document.querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', () => {
  mode = button.dataset.choice;
  document.querySelectorAll('[data-choice]').forEach(item => item.classList.toggle('active', item === button));
  $('#host-options').hidden = mode !== 'host';
  $('#join-options').hidden = mode !== 'join';
  $('#continue').innerHTML = mode === 'host' ? 'CREATE PRIVATE ROOM <span>→</span>' : 'JOIN PRIVATE ROOM <span>→</span>';
}));
document.querySelectorAll('[data-count]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-count]').forEach(item => item.classList.toggle('active', item === button));
  $('#count-label').textContent = button.dataset.count;
}));
$('#continue').addEventListener('click', () => {
  if (!$('#player-name').value.trim()) return toast('Enter your player name.');
  if (mode === 'join' && !$('#private-code').value.trim()) return toast('Enter your friend’s room code.');
  const selectedCount = document.querySelector('[data-count].active')?.dataset.count || '3';
  sessionStorage.setItem('junctionSetup', JSON.stringify({
    name: $('#player-name').value.trim(), mode, playerCount: selectedCount,
    code: mode === 'join' ? $('#private-code').value.trim().toUpperCase() : ''
  }));
  document.body.classList.add('leaving');
  setTimeout(() => location.href = 'room.html', 260);
});
