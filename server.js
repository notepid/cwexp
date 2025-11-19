const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Application state
const state = {
  backlog: [],
  audioClientId: null,
  config: {
    wpm: 20,
    delayBetweenItems: 1000,
    ditFrequency: 600,
    dahFrequency: 600
  }
};

// Client tracking
const clients = new Map();
let clientIdCounter = 0;

// Broadcast state to all clients
function broadcast(message) {
  const data = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.ws.readyState === 1) { // WebSocket.OPEN
      client.ws.send(data);
    }
  });
}

// Send state to specific client
function sendToClient(clientId, message) {
  const client = clients.get(clientId);
  if (client && client.ws.readyState === 1) {
    client.ws.send(JSON.stringify(message));
  }
}

// Get full state for a client
function getStateForClient(clientId) {
  return {
    type: 'state',
    backlog: state.backlog,
    config: state.config,
    audioClientId: state.audioClientId,
    isAudioClient: state.audioClientId === clientId,
    clientId: clientId,
    connectedClients: clients.size
  };
}

wss.on('connection', (ws) => {
  const clientId = ++clientIdCounter;
  clients.set(clientId, { ws, id: clientId });

  console.log(`Client ${clientId} connected. Total clients: ${clients.size}`);

  // Send initial state to new client
  sendToClient(clientId, getStateForClient(clientId));

  // Notify all clients of connection count change
  broadcast({
    type: 'clientCount',
    count: clients.size
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleMessage(clientId, message);
    } catch (err) {
      console.error('Error parsing message:', err);
    }
  });

  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`Client ${clientId} disconnected. Total clients: ${clients.size}`);

    // If audio client disconnected, clear audio client
    if (state.audioClientId === clientId) {
      state.audioClientId = null;
      broadcast({
        type: 'audioClientChanged',
        audioClientId: null
      });
    }

    // Notify all clients of connection count change
    broadcast({
      type: 'clientCount',
      count: clients.size
    });
  });
});

function handleMessage(clientId, message) {
  switch (message.type) {
    case 'addCallsign':
      if (message.callsign && message.callsign.trim()) {
        const callsign = message.callsign.trim().toUpperCase();
        state.backlog.push({
          id: Date.now() + Math.random(),
          callsign: callsign,
          addedBy: clientId,
          addedAt: new Date().toISOString()
        });
        broadcast({
          type: 'backlogUpdated',
          backlog: state.backlog
        });
      }
      break;

    case 'removeCallsign':
      state.backlog = state.backlog.filter(item => item.id !== message.id);
      broadcast({
        type: 'backlogUpdated',
        backlog: state.backlog
      });
      break;

    case 'clearBacklog':
      state.backlog = [];
      broadcast({
        type: 'backlogUpdated',
        backlog: state.backlog
      });
      break;

    case 'reorderBacklog':
      if (Array.isArray(message.order)) {
        const newBacklog = [];
        message.order.forEach(id => {
          const item = state.backlog.find(i => i.id === id);
          if (item) newBacklog.push(item);
        });
        state.backlog = newBacklog;
        broadcast({
          type: 'backlogUpdated',
          backlog: state.backlog
        });
      }
      break;

    case 'claimAudio':
      if (state.audioClientId === null) {
        state.audioClientId = clientId;
        broadcast({
          type: 'audioClientChanged',
          audioClientId: clientId
        });
        // Send confirmation to the claiming client
        sendToClient(clientId, {
          type: 'audioClaimResult',
          success: true,
          isAudioClient: true
        });
      } else if (state.audioClientId === clientId) {
        // Already the audio client
        sendToClient(clientId, {
          type: 'audioClaimResult',
          success: true,
          isAudioClient: true
        });
      } else {
        // Another client has audio
        sendToClient(clientId, {
          type: 'audioClaimResult',
          success: false,
          message: 'Another client is currently the audio output'
        });
      }
      break;

    case 'releaseAudio':
      if (state.audioClientId === clientId) {
        state.audioClientId = null;
        broadcast({
          type: 'audioClientChanged',
          audioClientId: null
        });
      }
      break;

    case 'updateConfig':
      if (message.config) {
        Object.assign(state.config, message.config);
        broadcast({
          type: 'configUpdated',
          config: state.config
        });
      }
      break;

    case 'playNext':
      // Signal to audio client to play next item
      if (state.audioClientId && state.backlog.length > 0) {
        sendToClient(state.audioClientId, {
          type: 'playCallsign',
          item: state.backlog[0]
        });
      }
      break;

    case 'callsignPlayed':
      // Remove the played callsign from backlog
      if (message.id) {
        state.backlog = state.backlog.filter(item => item.id !== message.id);
        broadcast({
          type: 'backlogUpdated',
          backlog: state.backlog
        });
      }
      break;

    default:
      console.log('Unknown message type:', message.type);
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`CW Pileup Manager server running on http://localhost:${PORT}`);
});
