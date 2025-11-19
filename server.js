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
let backlogIdCounter = 0;

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
          id: ++backlogIdCounter,
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
      if (typeof message.id === 'number' && Number.isFinite(message.id)) {
        state.backlog = state.backlog.filter(item => item.id !== message.id);
        broadcast({
          type: 'backlogUpdated',
          backlog: state.backlog
        });
      } else {
        console.warn(`Invalid id for removeCallsign: ${message.id}`);
      }
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
        const orderSet = new Set(message.order);

        // Add items in the new order
        message.order.forEach(id => {
          const item = state.backlog.find(i => i.id === id);
          if (item) newBacklog.push(item);
        });

        // Preserve items not in the order array by appending them at the end
        state.backlog.forEach(item => {
          if (!orderSet.has(item.id)) {
            newBacklog.push(item);
          }
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
        // Validate config values
        const newConfig = {};

        if (typeof message.config.wpm === 'number' && message.config.wpm >= 5 && message.config.wpm <= 50) {
          newConfig.wpm = message.config.wpm;
        }

        if (typeof message.config.delayBetweenItems === 'number' && message.config.delayBetweenItems >= 0 && message.config.delayBetweenItems <= 10000) {
          newConfig.delayBetweenItems = message.config.delayBetweenItems;
        }

        if (typeof message.config.ditFrequency === 'number' && message.config.ditFrequency >= 200 && message.config.ditFrequency <= 1500) {
          newConfig.ditFrequency = message.config.ditFrequency;
        }

        if (typeof message.config.dahFrequency === 'number' && message.config.dahFrequency >= 200 && message.config.dahFrequency <= 1500) {
          newConfig.dahFrequency = message.config.dahFrequency;
        }

        // Only update and broadcast if there are valid changes
        if (Object.keys(newConfig).length > 0) {
          Object.assign(state.config, newConfig);
          broadcast({
            type: 'configUpdated',
            config: state.config
          });
        }
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
      if (typeof message.id === 'number' && Number.isFinite(message.id)) {
        state.backlog = state.backlog.filter(item => item.id !== message.id);
        broadcast({
          type: 'backlogUpdated',
          backlog: state.backlog
        });
      } else {
        console.warn(`Invalid id for callsignPlayed: ${message.id}`);
      }
      break;

    case 'waterfallFrame':
      // Forward downsampled waterfall frames from the audio client to all clients
      if (Array.isArray(message.bins) && state.audioClientId === clientId) {
        broadcast({
          type: 'waterfallFrame',
          bins: message.bins
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
