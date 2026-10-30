const $ = selector => document.querySelector(selector);
const saved = JSON.parse(sessionStorage.getItem('junctionSetup') || '{}');
const colors = ['purple', 'yellow', 'blue', 'coral', 'mint', 'yellow'];
const symbols = { 'Moon Mango':'🥭', 'Rocket Raccoon':'🦝', 'Neon Ninja':'🥷', 'Pixel Panda':'🐼', 'Turbo Tiger':'🐯', 'Cosmic Cat':'🐱' };
let myId, room, game, socket, selectedCard;
function toast(message) { $('#toast').textContent = message; $('#toast').style.display = 'block'; setTimeout(() => $('#toast').style.display = 'none', 2200); }
function renderRoom() {
  if (!room) return; const isHost = room.hostId === myId;
  $('#room-code').textContent = room.code; $('#player-total').textContent = `${room.players.length} / ${room.maxPlayers}`;
  $('#joined-list').innerHTML = Array.from({ length: room.maxPlayers }, (_, i) => { const p = room.players[i]; return p ? `<div class="joined-player"><div class="avatar ${colors[i]}">${p.name[0].toUpperCase()}</div><b>${p.name}</b><small>${p.id === room.hostId ? 'HOST' : 'JOINED'}</small></div>` : '<div class="joined-player empty"><div class="avatar">?</div><b>Waiting for player…</b></div>'; }).join('');
  const ready = isHost && room.players.length === room.maxPlayers; $('#start-game').disabled = !ready; $('#start-game').classList.toggle('ready', ready); $('#start-game').textContent = ready ? 'START GAME →' : 'WAITING FOR PLAYERS';
  const remaining = room.maxPlayers - room.players.length; $('#waiting-message').textContent = remaining ? `${remaining} more player${remaining === 1 ? '' : 's'} needed` : (isHost ? 'Everyone is here!' : 'Waiting for the host to start');
}
function renderGame() {
  if (!game) return; $('#game-room-code').textContent = `ROOM ${game.code}`; $('#game-phase').textContent = game.phase === 'passing' ? 'PASS CARDS' : game.phase === 'stacking' ? 'STACK HANDS' : 'ROUND COMPLETE';
  $('#game-players').innerHTML = game.players.map(p => `<span class="game-player ${p.id === myId ? 'you' : ''}">${p.name}${p.id === game.hostId ? ' ★' : ''}</span>`).join('');
  const matching = game.hand.length === 4 && new Set(game.hand).size === 1;
  $('#live-hand').innerHTML = game.hand.map((card, i) => `<button class="live-card theme-${['Moon Mango','Rocket Raccoon','Neon Ninja','Pixel Panda','Turbo Tiger','Cosmic Cat'].indexOf(card)} ${selectedCard === `${card}-${i}` ? 'selected' : ''}" data-card="${card}" data-key="${card}-${i}"><span>✦</span><span class="symbol">${symbols[card]}</span><span>${card.toUpperCase()}</span></button>`).join('');
  document.querySelectorAll('[data-card]').forEach(button => button.addEventListener('click', () => { if (game.phase !== 'passing') return; selectedCard = button.dataset.key; $('#pass-card').disabled = false; $('#pass-card').textContent = `PASS ${button.dataset.card.toUpperCase()} →`; renderGame(); }));
  $('#pass-card').hidden = game.phase !== 'passing'; $('#call-junction').hidden = game.phase !== 'passing'; $('#call-junction').disabled = !matching;
  const canStack = game.phase === 'stacking' && !game.rankings.some(rank => rank.id === myId); $('#stack-hand').hidden = !canStack;
  $('#game-status').textContent = game.phase === 'passing' ? `Pass one card to ${game.nextPlayerName}. Collect four matching cards!` : game.phase === 'stacking' ? `${game.rankings[0]?.name} called JUNCTION! Put your hand in fast.` : 'Round finished!';
  $('#rankings').textContent = game.rankings.length ? game.rankings.map((rank, i) => `#${i + 1} ${rank.name}`).join('  ·  ') : '';
}
$('#copy-code').addEventListener('click', async () => { try { await navigator.clipboard.writeText(room?.code || ''); toast('Room code copied!'); } catch { toast(room?.code || ''); } });
$('#leave').addEventListener('click', () => { socket?.close(); location.href = 'index.html'; });
$('#start-game').addEventListener('click', () => socket?.send(JSON.stringify({ type: 'start_game' })));
$('#pass-card').addEventListener('click', () => { if (!selectedCard) return; socket?.send(JSON.stringify({ type: 'pass_card', card: selectedCard.replace(/-\d+$/, '') })); selectedCard = null; $('#pass-card').disabled = true; });
$('#call-junction').addEventListener('click', () => socket?.send(JSON.stringify({ type: 'call_junction' })));
$('#stack-hand').addEventListener('click', () => socket?.send(JSON.stringify({ type: 'stack_hand' })));
socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
socket.addEventListener('message', event => { const msg = JSON.parse(event.data);
  if (msg.type === 'connected') { myId = msg.id; socket.send(JSON.stringify(saved.mode === 'join' ? { type:'join_room', name:saved.name, code:saved.code } : { type:'create_room', name:saved.name, maxPlayers:saved.playerCount })); }
  if (msg.type === 'room_state') { room = msg.room; renderRoom(); }
  if (msg.type === 'game_state') { game = msg.game; room = msg.game; renderGame(); }
  if (msg.type === 'game_started') { $('.room-page:not(#game-screen)').hidden = true; $('#game-screen').hidden = false; }
  if (msg.type === 'error') toast(msg.message);
});
socket.addEventListener('close', () => toast('Connection closed. Refresh to reconnect.'));
