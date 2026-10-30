const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const PORT = Number(process.env.PORT || 5173);
const root = path.join(__dirname, 'public');
const rooms = new Map(), clients = new Map();
const cardSets = ['Moon Mango', 'Rocket Raccoon', 'Neon Ninja', 'Pixel Panda', 'Turbo Tiger', 'Cosmic Cat'];
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

class Socket extends EventEmitter {
  constructor(conn) { super(); this.conn = conn; this.buffer = Buffer.alloc(0); this.readyState = 1; conn.on('data', d => this.read(d)); conn.on('close', () => this.close()); conn.on('error', () => this.close()); }
  send(message) { if (this.readyState !== 1) return; const data = Buffer.from(JSON.stringify(message)); if (data.length >= 65536) return; const header = data.length < 126 ? Buffer.from([129, data.length]) : Buffer.from([129, 126, data.length >> 8, data.length & 255]); this.conn.write(Buffer.concat([header, data])); }
  read(chunk) { this.buffer = Buffer.concat([this.buffer, chunk]); while (this.buffer.length >= 2) { const first = this.buffer[0], second = this.buffer[1], opcode = first & 15; let length = second & 127, offset = 2; if (length === 126) { if (this.buffer.length < 4) return; length = this.buffer.readUInt16BE(2); offset = 4; } if (!(second & 128) || this.buffer.length < offset + 4 + length) return; const mask = this.buffer.subarray(offset, offset + 4), payload = Buffer.from(this.buffer.subarray(offset + 4, offset + 4 + length)); for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4]; this.buffer = this.buffer.subarray(offset + 4 + length); if (opcode === 8) return this.close(); if (opcode === 1) this.emit('message', payload.toString()); } }
  close() { if (this.readyState !== 1) return; this.readyState = 3; this.emit('close'); }
}

function makeCode() { let value; do { value = crypto.randomBytes(3).toString('hex').toUpperCase(); } while (rooms.has(value)); return value; }
function roomOf(id) { return rooms.get(clients.get(id)?.room); }
function error(socket, message) { socket.send({ type: 'error', message }); }
function roomState(room) { return { code: room.code, maxPlayers: room.maxPlayers, hostId: room.hostId, phase: room.phase, players: room.members.map(id => ({ id, name: clients.get(id)?.name || 'Disconnected' })), rankings: room.rankings.map(id => ({ id, name: clients.get(id)?.name || 'Player' })) }; }
function broadcastRoom(room) { const message = { type: 'room_state', room: roomState(room) }; room.members.forEach(id => clients.get(id)?.socket.send(message)); }
function gameState(room, id) { return { type: 'game_state', game: { ...roomState(room), hand: room.hands[id] || [], nextPlayerName: clients.get(room.members[(room.members.indexOf(id) + 1) % room.members.length])?.name || 'next player' } }; }
function broadcastGame(room) { room.members.forEach(id => clients.get(id)?.socket.send(gameState(room, id))); }
function leave(id) { const player = clients.get(id), room = roomOf(id); if (!room) return; room.members = room.members.filter(member => member !== id); delete room.hands[id]; if (room.hostId === id) room.hostId = room.members[0]; if (!room.members.length) rooms.delete(room.code); else if (room.phase === 'waiting') broadcastRoom(room); else broadcastGame(room); }
function shuffle(deck) { for (let i = deck.length - 1; i > 0; i -= 1) { const j = crypto.randomInt(i + 1); [deck[i], deck[j]] = [deck[j], deck[i]]; } return deck; }
function startGame(room) { const deck = shuffle(cardSets.slice(0, room.maxPlayers).flatMap(name => Array(4).fill(name))); room.phase = 'passing'; room.rankings = []; room.hands = {}; room.members.forEach((id, index) => { room.hands[id] = deck.slice(index * 4, index * 4 + 4); }); broadcastRoom(room); room.members.forEach(id => clients.get(id)?.socket.send({ type: 'game_started' })); broadcastGame(room); }
function passCard(room, id, card) { if (room.phase !== 'passing') return; const hand = room.hands[id]; const cardIndex = hand?.indexOf(card); if (cardIndex === undefined || cardIndex < 0) return error(clients.get(id).socket, 'That card is not in your hand.'); const nextId = room.members[(room.members.indexOf(id) + 1) % room.members.length]; hand.splice(cardIndex, 1); room.hands[nextId].push(card); broadcastGame(room); }
function callJunction(room, id) { const hand = room.hands[id]; if (room.phase !== 'passing') return; if (!hand || hand.length !== 4 || new Set(hand).size !== 1) return error(clients.get(id).socket, 'You need four matching cards to call Junction.'); room.phase = 'stacking'; room.rankings = [id]; broadcastRoom(room); broadcastGame(room); }
function stackHand(room, id) { if (room.phase !== 'stacking' || room.rankings.includes(id)) return; room.rankings.push(id); if (room.rankings.length === room.members.length) room.phase = 'finished'; broadcastRoom(room); broadcastGame(room); }
function receive(id, text) { let msg; try { msg = JSON.parse(text); } catch { return; } const player = clients.get(id); if (!player) return;
  if (msg.type === 'create_room') { if (player.room) leave(id); const max = Number(msg.maxPlayers); if (!Number.isInteger(max) || max < 3 || max > 6) return error(player.socket, 'Choose 3–6 players.'); const room = { code: makeCode(), maxPlayers: max, hostId: id, members: [id], phase: 'waiting', rankings: [], hands: {} }; player.name = String(msg.name || '').trim().slice(0, 16) || 'Player'; player.room = room.code; rooms.set(room.code, room); return broadcastRoom(room); }
  if (msg.type === 'join_room') { if (player.room) leave(id); const room = rooms.get(String(msg.code || '').trim().toUpperCase()); if (!room) return error(player.socket, 'Room code not found.'); if (room.phase !== 'waiting') return error(player.socket, 'This game already started.'); if (room.members.length >= room.maxPlayers) return error(player.socket, 'This room is full.'); player.name = String(msg.name || '').trim().slice(0, 16) || 'Player'; player.room = room.code; room.members.push(id); return broadcastRoom(room); }
  const room = roomOf(id); if (!room) return;
  if (msg.type === 'start_game') { if (room.hostId !== id) return error(player.socket, 'Only the host can start.'); if (room.members.length !== room.maxPlayers) return error(player.socket, 'Wait until everyone has joined.'); return startGame(room); }
  if (msg.type === 'pass_card') return passCard(room, id, String(msg.card || ''));
  if (msg.type === 'call_junction') return callJunction(room, id);
  if (msg.type === 'stack_hand') return stackHand(room, id);
}

const server = http.createServer((req, res) => { const pathname = new URL(req.url, 'http://localhost').pathname; const file = path.resolve(root, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')); if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); return res.end('Not found'); } res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res); });
server.on('upgrade', (req, conn) => { const key = req.headers['sec-websocket-key']; if (!key) return conn.destroy(); const accept = crypto.createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64'); conn.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`); const socket = new Socket(conn), id = crypto.randomUUID(); clients.set(id, { socket, name: 'Player', room: null }); socket.send({ type: 'connected', id }); socket.on('message', data => receive(id, data)); socket.on('close', () => { leave(id); clients.delete(id); }); });
server.listen(PORT, () => console.log(`Junction is running at http://localhost:${PORT}`));
