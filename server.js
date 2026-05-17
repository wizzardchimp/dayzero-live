const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const players = {};

function sanitise(name) {
  return name.trim().slice(0, 20) || 'Anonymous';
}

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('join', (name) => {
    players[socket.id] = {
      id: socket.id,
      name: sanitise(name),
      connected: true,
      round: 0,
      phase: 'intro',
      budget: 300000,
      blocked: 0,
      breaches: 0,
      defences: [],
      lastAttack: null,
      lastResult: null,
    };
    socket.emit('joined', { id: socket.id });
    io.emit('players-update', Object.values(players));
    console.log(`${players[socket.id].name} joined`);
  });

  socket.on('report-result', (data) => {
    const p = players[socket.id];
    if (!p) return;
    Object.assign(p, data);
    io.emit('players-update', Object.values(players));
  });

  socket.on('disconnect', () => {
    const p = players[socket.id];
    if (p) console.log(`${p.name} disconnected`);
    delete players[socket.id];
    io.emit('players-update', Object.values(players));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Day Zero Live running on http://localhost:${PORT}`);
  const os = require('os');
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`  Network: http://${iface.address}:${PORT}`);
      }
    }
  }
});
