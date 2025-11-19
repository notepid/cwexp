// Morse code definitions
const MORSE_CODE = {
  'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
  'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
  'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
  'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
  'Y': '-.--', 'Z': '--..', '0': '-----', '1': '.----', '2': '..---',
  '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...',
  '8': '---..', '9': '----.', '/': '-..-.', '.': '.-.-.-', ',': '--..--',
  '?': '..--..', '=': '-...-'
};

// Notification system
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.setAttribute('role', 'alert');

  const icon = document.createElement('span');
  icon.className = 'notification-icon';
  icon.textContent = type === 'error' ? '⚠️' : type === 'success' ? '✓' : 'ℹ️';

  const messageEl = document.createElement('span');
  messageEl.className = 'notification-message';
  messageEl.textContent = message;

  notification.appendChild(icon);
  notification.appendChild(messageEl);
  notificationContainer.appendChild(notification);

  // Remove after animation completes
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Modal dialog system
function showModal(title, message, confirmText = 'OK', cancelText = 'Cancel') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'modal-title');

    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog';

    const header = document.createElement('div');
    header.className = 'modal-header';
    header.id = 'modal-title';
    header.textContent = title;

    const body = document.createElement('div');
    body.className = 'modal-body';
    body.textContent = message;

    const footer = document.createElement('div');
    footer.className = 'modal-footer';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = cancelText;
    cancelBtn.onclick = () => {
      overlay.remove();
      resolve(false);
    };

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn btn-primary';
    confirmBtn.textContent = confirmText;
    confirmBtn.onclick = () => {
      overlay.remove();
      resolve(true);
    };

    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);

    dialog.appendChild(header);
    dialog.appendChild(body);
    dialog.appendChild(footer);
    overlay.appendChild(dialog);

    document.body.appendChild(overlay);

    // Focus on confirm button
    confirmBtn.focus();

    // Close on overlay click
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(false);
      }
    };

    // Close on Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        overlay.remove();
        resolve(false);
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  });
}

// Application state
let ws = null;
let audioContext = null;
let isAudioClient = false;
let isPlaying = false;
let isPlaybackEnabled = false; // Continuous playback mode
let shouldStop = false;
let clientId = null;
let backlog = [];
let config = {
  wpm: 20,
  delayBetweenItems: 1000,
  ditFrequency: 600,
  dahFrequency: 600
};

// Waterfall state
let micStream = null;
let waterfallAnalyser = null;
let waterfallDataArray = null;
let waterfallAnimationId = null;
let waterfallRunning = false;
let waterfallCanvas = null;
let waterfallCanvasCtx = null;
let embeddedWaterfallCanvas = null;
let embeddedWaterfallCtx = null;
let lastWaterfallSendTime = 0;
const WATERFALL_SEND_INTERVAL = 100; // ms, ~10 FPS
const WATERFALL_DOWNSAMPLED_BINS = 128;

// DOM elements
const connectionStatus = document.getElementById('connectionStatus');
const clientCount = document.getElementById('clientCount');
const audioStatus = document.getElementById('audioStatus');
const wpmInput = document.getElementById('wpm');
const delayInput = document.getElementById('delayBetweenItems');
const ditFreqInput = document.getElementById('ditFrequency');
const dahFreqInput = document.getElementById('dahFrequency');
const claimAudioBtn = document.getElementById('claimAudioBtn');
const releaseAudioBtn = document.getElementById('releaseAudioBtn');
const audioInfo = document.getElementById('audioInfo');
const callsignForm = document.getElementById('callsignForm');
const callsignInput = document.getElementById('callsignInput');
const backlogList = document.getElementById('backlogList');
const backlogCount = document.getElementById('backlogCount');
const playAllBtn = document.getElementById('playAllBtn');
const stopBtn = document.getElementById('stopBtn');
const clearBacklogBtn = document.getElementById('clearBacklogBtn');
const nowPlayingSection = document.getElementById('nowPlayingSection');
const nowPlayingCallsign = document.getElementById('nowPlayingCallsign');
const nowPlayingMorse = document.getElementById('nowPlayingMorse');
const notificationContainer = document.getElementById('notificationContainer');
const managerViewTab = document.getElementById('managerViewTab');
const waterfallViewTab = document.getElementById('waterfallViewTab');
const managerView = document.getElementById('managerView');
const waterfallView = document.getElementById('waterfallView');
const embeddedWaterfallSection = document.getElementById('embeddedWaterfallSection');
const startWaterfallBtn = document.getElementById('startWaterfallBtn');
const stopWaterfallBtn = document.getElementById('stopWaterfallBtn');
const waterfallStatus = document.getElementById('waterfallStatus');

// Canvas references (assigned during init)
waterfallCanvas = document.getElementById('waterfallCanvas');
embeddedWaterfallCanvas = document.getElementById('embeddedWaterfallCanvas');

// Initialize WebSocket connection
function connect() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}`);

  ws.onopen = () => {
    connectionStatus.textContent = 'Connected';
    connectionStatus.className = 'status connected';
    console.log('Connected to server');
  };

  ws.onclose = () => {
    connectionStatus.textContent = 'Disconnected';
    connectionStatus.className = 'status disconnected';
    console.log('Disconnected from server');
    // Attempt to reconnect after 3 seconds
    setTimeout(connect, 3000);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleServerMessage(message);
  };
}

// Handle messages from server
function handleServerMessage(message) {
  switch (message.type) {
    case 'state':
      clientId = message.clientId;
      backlog = message.backlog;
      config = message.config;
      isAudioClient = message.isAudioClient;
      updateConfigUI();
      updateBacklogUI();
      updateAudioUI(message.audioClientId);
      clientCount.textContent = `Clients: ${message.connectedClients}`;
      break;

    case 'backlogUpdated':
      backlog = message.backlog;
      updateBacklogUI();
      break;

    case 'configUpdated':
      config = message.config;
      updateConfigUI();
      break;

    case 'audioClientChanged':
      isAudioClient = message.audioClientId === clientId;
      updateAudioUI(message.audioClientId);
      break;

    case 'audioClaimResult':
      if (message.success) {
        isAudioClient = true;
        updateAudioButtons();
      } else {
        showNotification(message.message || 'Failed to claim audio output', 'error');
      }
      break;

    case 'clientCount':
      clientCount.textContent = `Clients: ${message.count}`;
      break;

    case 'playCallsign':
      if (isAudioClient && message.item) {
        playCallsign(message.item);
      }
      break;

    case 'waterfallFrame':
      // Non-audio clients render waterfall frames received from the audio client
      if (!isAudioClient && Array.isArray(message.bins)) {
        console.log('Received waterfall frame with', message.bins.length, 'bins');
        drawRemoteWaterfall(message.bins);
      }
      break;
  }
}

// Update configuration UI
function updateConfigUI() {
  wpmInput.value = config.wpm;
  delayInput.value = config.delayBetweenItems;
  ditFreqInput.value = config.ditFrequency;
  dahFreqInput.value = config.dahFrequency;
}

// Update backlog UI
function updateBacklogUI() {
  backlogCount.textContent = backlog.length;

  if (backlog.length === 0) {
    backlogList.innerHTML = '<p class="empty-message">No callsigns in backlog</p>';
    playAllBtn.disabled = true;
  } else {
    backlogList.innerHTML = backlog.map((item, index) => `
      <div class="backlog-item" data-id="${item.id}">
        <span class="backlog-number">${index + 1}</span>
        <span class="backlog-callsign">${item.callsign}</span>
        <span class="backlog-morse">${callsignToMorse(item.callsign)}</span>
        <button class="btn btn-small btn-danger remove-btn" data-id="${item.id}">Remove</button>
      </div>
    `).join('');

    playAllBtn.disabled = !isAudioClient;
  }
}

// Update audio UI
function updateAudioUI(audioClientId) {
  if (audioClientId === null) {
    audioStatus.textContent = 'Audio: None';
    audioStatus.className = 'audio-status';
    audioInfo.textContent = 'No client is currently outputting audio';
  } else if (audioClientId === clientId) {
    audioStatus.textContent = 'Audio: You';
    audioStatus.className = 'audio-status active';
    audioInfo.textContent = 'You are the audio output client';
  } else {
    audioStatus.textContent = `Audio: Client ${audioClientId}`;
    audioStatus.className = 'audio-status';
    audioInfo.textContent = `Client ${audioClientId} is the audio output`;
  }
  updateAudioButtons();
  updateWaterfallControls();
}

// Update audio control buttons
function updateAudioButtons() {
  claimAudioBtn.disabled = isAudioClient;
  releaseAudioBtn.disabled = !isAudioClient;
  playAllBtn.disabled = !isAudioClient;
  stopBtn.disabled = !isPlaybackEnabled;

  // Update button text based on playback mode
  if (isPlaybackEnabled) {
    playAllBtn.textContent = 'Disable Playback';
    playAllBtn.className = 'btn btn-warning';
  } else {
    playAllBtn.textContent = 'Play All';
    playAllBtn.className = 'btn btn-success';
  }
}

// Update waterfall controls based on audio client state and running status
function updateWaterfallControls() {
  if (!startWaterfallBtn || !stopWaterfallBtn || !waterfallStatus) return;

  // Always show the waterfall section (even for non-audio clients receiving broadcast)
  if (embeddedWaterfallSection) {
    embeddedWaterfallSection.setAttribute('aria-hidden', 'false');
    embeddedWaterfallSection.style.opacity = '1';
  }

  if (!isAudioClient) {
    startWaterfallBtn.disabled = true;
    stopWaterfallBtn.disabled = true;
    waterfallStatus.textContent = 'Viewing waterfall from audio client. Only the audio client can control it.';
  } else {
    startWaterfallBtn.disabled = waterfallRunning;
    stopWaterfallBtn.disabled = !waterfallRunning;

    if (waterfallRunning) {
      waterfallStatus.textContent = 'Waterfall running. Broadcasting to all clients.';
    } else if (!micStream) {
      waterfallStatus.textContent = 'Waterfall ready. Click \"Start Waterfall\" to begin.';
    } else {
      waterfallStatus.textContent = 'Microphone ready. Start the waterfall to view activity.';
    }
  }
}

// Convert callsign to Morse code string
function callsignToMorse(callsign) {
  return callsign.split('').map(char => MORSE_CODE[char] || '').join(' ');
}

// Initialize audio context
function initAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
}

// Initialize or resize waterfall canvases
function setupWaterfallCanvases(shouldClear = false) {
  if (waterfallCanvas) {
    resizeCanvas(waterfallCanvas);
    if (!waterfallCanvasCtx) {
      waterfallCanvasCtx = waterfallCanvas.getContext('2d');
      shouldClear = true; // Always clear on first initialization
    }
    if (shouldClear) {
      clearCanvas(waterfallCanvasCtx, waterfallCanvas);
    }
  }

  if (embeddedWaterfallCanvas) {
    resizeCanvas(embeddedWaterfallCanvas);
    if (!embeddedWaterfallCtx) {
      embeddedWaterfallCtx = embeddedWaterfallCanvas.getContext('2d');
      shouldClear = true; // Always clear on first initialization
    }
    if (shouldClear) {
      clearCanvas(embeddedWaterfallCtx, embeddedWaterfallCanvas);
    }
  }
}

function resizeCanvas(canvas) {
  if (!canvas) return;
  const width = canvas.clientWidth || 600;
  const height = canvas.clientHeight || 200;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function clearCanvas(ctx, canvas) {
  if (!ctx || !canvas) return;
  ctx.fillStyle = '#000814';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Microphone + analyser setup for waterfall
async function initWaterfallAudio() {
  if (micStream && waterfallAnalyser && waterfallDataArray) {
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    waterfallStatus.textContent = 'Microphone API not supported in this browser.';
    showNotification('Microphone API not supported in this browser', 'error');
    return;
  }

  initAudioContext();

  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    const source = audioContext.createMediaStreamSource(micStream);
    waterfallAnalyser = audioContext.createAnalyser();
    waterfallAnalyser.fftSize = 2048;
    waterfallAnalyser.smoothingTimeConstant = 0.8;
    waterfallAnalyser.minDecibels = -100;
    waterfallAnalyser.maxDecibels = -30;

    source.connect(waterfallAnalyser);

    waterfallDataArray = new Uint8Array(waterfallAnalyser.frequencyBinCount);
    waterfallStatus.textContent = 'Microphone ready. Start the waterfall to view activity.';
  } catch (err) {
    console.error('Error accessing microphone for waterfall:', err);
    waterfallStatus.textContent = 'Unable to access microphone. Check permissions and input device.';
    showNotification('Unable to access microphone for waterfall', 'error');
  }
}

// Start the local waterfall (audio client only)
async function startWaterfall() {
  if (!isAudioClient) {
    showNotification('Only the audio output client can start the waterfall', 'error');
    return;
  }

  if (waterfallRunning) return;

  waterfallStatus.textContent = 'Starting waterfall...';

  await initWaterfallAudio();

  if (!waterfallAnalyser || !waterfallDataArray) {
    return;
  }

  setupWaterfallCanvases(true); // Clear on start
  waterfallRunning = true;
  updateWaterfallControls();

  const loop = () => {
    if (!waterfallRunning || !waterfallAnalyser || !waterfallDataArray) {
      return;
    }

    waterfallAnalyser.getByteFrequencyData(waterfallDataArray);
    drawWaterfallColumn(waterfallDataArray);
    maybeSendWaterfallFrame(waterfallDataArray);

    waterfallAnimationId = requestAnimationFrame(loop);
  };

  loop();
}

// Stop the local waterfall and release microphone
function stopWaterfall() {
  if (!waterfallRunning && !micStream) return;

  waterfallRunning = false;

  if (waterfallAnimationId !== null) {
    cancelAnimationFrame(waterfallAnimationId);
    waterfallAnimationId = null;
  }

  if (micStream) {
    micStream.getTracks().forEach(track => track.stop());
    micStream = null;
  }

  waterfallAnalyser = null;
  waterfallDataArray = null;

  waterfallStatus.textContent = 'Waterfall stopped.';
  updateWaterfallControls();
}

// Map magnitude (0..1) to RGB color
function magnitudeToColor(mag) {
  const brightness = Math.pow(Math.max(0, Math.min(1, mag)), 1.4);
  const r = 20 + Math.floor(80 * brightness);
  const g = 80 + Math.floor(160 * brightness);
  const b = 120 + Math.floor(135 * brightness);
  return {
    r: Math.max(0, Math.min(255, r)),
    g: Math.max(0, Math.min(255, g)),
    b: Math.max(0, Math.min(255, b))
  };
}

// Draw a single vertical column to both canvases
function drawWaterfallColumn(bins) {
  if (!bins || bins.length === 0) return;
  const data = bins instanceof Uint8Array ? bins : Uint8Array.from(bins);

  if (waterfallCanvas && waterfallCanvasCtx) {
    drawColumnOnCanvas(waterfallCanvasCtx, waterfallCanvas, data);
  }

  if (embeddedWaterfallCanvas && embeddedWaterfallCtx) {
    drawColumnOnCanvas(embeddedWaterfallCtx, embeddedWaterfallCanvas, data);
  }
}

function drawColumnOnCanvas(ctx, canvas, bins) {
  if (!ctx || !canvas) {
    console.log('drawColumnOnCanvas: missing ctx or canvas');
    return;
  }
  const width = canvas.width;
  const height = canvas.height;
  if (!width || !height) {
    console.log('drawColumnOnCanvas: invalid dimensions', width, height);
    return;
  }

  // Scroll existing image one pixel to the left
  const imageData = ctx.getImageData(1, 0, width - 1, height);
  ctx.putImageData(imageData, 0, 0);

  // New column on the right
  const column = ctx.createImageData(1, height);

  // Sample a few bins to see what we're drawing
  let sampleBins = [];
  for (let y = 0; y < height; y++) {
    const relY = 1 - y / height; // 0 at bottom, 1 at top
    const binIndex = Math.min(
      bins.length - 1,
      Math.max(0, Math.floor(relY * bins.length))
    );
    const mag = bins[binIndex] / 255;
    if (y % 50 === 0) sampleBins.push({ y, binIndex, binValue: bins[binIndex], mag });
    const color = magnitudeToColor(mag);
    const idx = y * 4;
    column.data[idx] = color.r;
    column.data[idx + 1] = color.g;
    column.data[idx + 2] = color.b;
    column.data[idx + 3] = 255;
  }

  if (Math.random() < 0.05) { // Log occasionally to avoid spam
    console.log('Sample bins being drawn:', sampleBins);
  }

  ctx.putImageData(column, width - 1, 0);
}

// Downsample FFT bins and send to server for remote waterfall display
function maybeSendWaterfallFrame(bins) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const now = performance.now();
  if (now - lastWaterfallSendTime < WATERFALL_SEND_INTERVAL) return;
  lastWaterfallSendTime = now;

  const src = bins;
  const targetLength = WATERFALL_DOWNSAMPLED_BINS;
  const result = new Uint8Array(targetLength);
  const binSize = src.length / targetLength;

  for (let i = 0; i < targetLength; i++) {
    const start = Math.floor(i * binSize);
    const end = Math.floor((i + 1) * binSize);
    let max = 0;
    for (let j = start; j < end && j < src.length; j++) {
      if (src[j] > max) max = src[j];
    }
    result[i] = max;
  }

  console.log('Sending waterfall frame with', result.length, 'bins');
  send({ type: 'waterfallFrame', bins: Array.from(result) });
}

// Render waterfall from remote (server-sent) frames
function drawRemoteWaterfall(bins) {
  if (!Array.isArray(bins) || bins.length === 0) {
    console.log('drawRemoteWaterfall: invalid bins');
    return;
  }

  // Ensure canvases exist and are properly sized (but don't clear every frame!)
  if (!waterfallCanvas) {
    waterfallCanvas = document.getElementById('waterfallCanvas');
  }
  if (!embeddedWaterfallCanvas) {
    embeddedWaterfallCanvas = document.getElementById('embeddedWaterfallCanvas');
  }

  // Only setup (resize/init context) but don't clear unless contexts are null
  setupWaterfallCanvases(false); // Don't clear - we want to accumulate frames!
  console.log('Drawing remote waterfall column, canvas dimensions:',
    waterfallCanvas ? `${waterfallCanvas.width}x${waterfallCanvas.height}` : 'null',
    embeddedWaterfallCanvas ? `${embeddedWaterfallCanvas.width}x${embeddedWaterfallCanvas.height}` : 'null');
  drawWaterfallColumn(bins);
}

// Play a tone
function playTone(frequency, duration) {
  return new Promise((resolve) => {
    initAudioContext();

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    // Smooth envelope to avoid clicks
    const now = audioContext.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.5, now + 0.01);
    gainNode.gain.setValueAtTime(0.5, now + duration / 1000 - 0.01);
    gainNode.gain.linearRampToValueAtTime(0, now + duration / 1000);

    oscillator.start(now);
    oscillator.stop(now + duration / 1000);

    setTimeout(resolve, duration);
  });
}

// Calculate timing based on WPM
function getTimings() {
  // Standard PARIS timing: 50 units per word
  const unitTime = 1200 / config.wpm; // milliseconds per unit
  return {
    dit: unitTime,
    dah: unitTime * 3,
    intraChar: unitTime, // gap between dits/dahs in same character
    interChar: unitTime * 3, // gap between characters
    interWord: unitTime * 7 // gap between words
  };
}

// Play Morse code for a single character
async function playCharacter(char) {
  const morse = MORSE_CODE[char];
  if (!morse) return;

  const timings = getTimings();

  for (let i = 0; i < morse.length; i++) {
    if (shouldStop) return;

    const symbol = morse[i];
    if (symbol === '.') {
      await playTone(config.ditFrequency, timings.dit);
    } else if (symbol === '-') {
      await playTone(config.dahFrequency, timings.dah);
    }

    // Intra-character gap (except after last symbol)
    if (i < morse.length - 1) {
      await sleep(timings.intraChar);
    }
  }
}

// Play entire callsign
async function playCallsign(item) {
  if (!isAudioClient) return;

  isPlaying = true;
  shouldStop = false;
  updateAudioButtons();

  // Show now playing
  nowPlayingSection.style.display = 'block';
  nowPlayingCallsign.textContent = item.callsign;
  nowPlayingMorse.textContent = callsignToMorse(item.callsign);

  const timings = getTimings();
  const callsign = item.callsign.toUpperCase();

  for (let i = 0; i < callsign.length; i++) {
    if (shouldStop) break;

    const char = callsign[i];
    await playCharacter(char);

    // Inter-character gap (except after last character)
    if (i < callsign.length - 1) {
      await sleep(timings.interChar);
    }
  }

  // Notify server that callsign was played
  if (!shouldStop) {
    send({ type: 'callsignPlayed', id: item.id });
  }

  // Hide now playing after delay
  await sleep(500);
  nowPlayingSection.style.display = 'none';

  isPlaying = false;
  updateAudioButtons();
}

// Play all callsigns in backlog (continuous mode)
async function playAll() {
  if (!isAudioClient) return;

  isPlaybackEnabled = true;
  shouldStop = false;
  updateAudioButtons();

  // Continuous playback loop - keeps running even when backlog is empty
  while (!shouldStop) {
    if (backlog.length > 0) {
      const item = backlog[0];
      if (item) {
        isPlaying = true;
        await playCallsign(item);
        isPlaying = false;

        // Delay between items if there are more items to play
        if (backlog.length > 0 && !shouldStop) {
          await sleep(config.delayBetweenItems);
        }
      }
    } else {
      // Backlog is empty, wait a bit before checking again
      await sleep(100);
    }
  }

  isPlaybackEnabled = false;
  isPlaying = false;
  updateAudioButtons();
}

// Stop continuous playback
function stopPlayback() {
  shouldStop = true;
  isPlaybackEnabled = false;
}

// Sleep utility
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Send message to server
function send(message) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

// Event listeners for configuration changes
function setupConfigListeners() {
  const updateConfig = () => {
    const newConfig = {
      wpm: parseInt(wpmInput.value) || 20,
      delayBetweenItems: parseInt(delayInput.value) || 1000,
      ditFrequency: parseInt(ditFreqInput.value) || 600,
      dahFrequency: parseInt(dahFreqInput.value) || 600
    };
    send({ type: 'updateConfig', config: newConfig });
  };

  wpmInput.addEventListener('change', updateConfig);
  delayInput.addEventListener('change', updateConfig);
  ditFreqInput.addEventListener('change', updateConfig);
  dahFreqInput.addEventListener('change', updateConfig);
}

// Event listeners
function setupEventListeners() {
  // Callsign form submission
  callsignForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const callsign = callsignInput.value.trim();
    if (callsign) {
      send({ type: 'addCallsign', callsign });
      callsignInput.value = '';
    }
  });

  // Audio control buttons
  claimAudioBtn.addEventListener('click', async () => {
    const confirmed = await showModal(
      'Claim Audio Output',
      'Do you want to become the audio output client? Only one client can output audio at a time.',
      'Claim',
      'Cancel'
    );
    if (confirmed) {
      initAudioContext(); // Initialize audio context on user interaction
      send({ type: 'claimAudio' });
    }
  });

  releaseAudioBtn.addEventListener('click', () => {
    send({ type: 'releaseAudio' });
  });

  // Playback controls
  playAllBtn.addEventListener('click', () => {
    if (isPlaybackEnabled) {
      // Stop continuous playback
      stopPlayback();
    } else {
      // Start continuous playback
      playAll();
    }
  });

  stopBtn.addEventListener('click', () => {
    stopPlayback();
  });

  clearBacklogBtn.addEventListener('click', async () => {
    const confirmed = await showModal(
      'Clear Backlog',
      'Are you sure you want to clear the entire backlog?',
      'Clear All',
      'Cancel'
    );
    if (confirmed) {
      send({ type: 'clearBacklog' });
    }
  });

  // Remove button delegation
  backlogList.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-btn')) {
      const id = parseFloat(e.target.dataset.id);
      send({ type: 'removeCallsign', id });
    }
  });

  setupConfigListeners();

  // View tabs
  if (managerViewTab && waterfallViewTab && managerView && waterfallView) {
    managerViewTab.addEventListener('click', () => {
      setActiveView('manager');
    });

    waterfallViewTab.addEventListener('click', () => {
      setActiveView('waterfall');
    });
  }

  // Waterfall controls
  if (startWaterfallBtn) {
    startWaterfallBtn.addEventListener('click', () => {
      startWaterfall();
    });
  }

  if (stopWaterfallBtn) {
    stopWaterfallBtn.addEventListener('click', () => {
      stopWaterfall();
    });
  }
}

function setActiveView(view) {
  if (!managerViewTab || !waterfallViewTab || !managerView || !waterfallView) return;

  const showManager = view === 'manager';

  managerViewTab.classList.toggle('active', showManager);
  waterfallViewTab.classList.toggle('active', !showManager);

  managerView.classList.toggle('active', showManager);
  waterfallView.classList.toggle('active', !showManager);

  managerView.hidden = !showManager;
  waterfallView.hidden = showManager;
}

// Initialize application
function init() {
  setupEventListeners();
  connect();
  setupWaterfallCanvases();
  updateWaterfallControls();

  window.addEventListener('resize', () => {
    waterfallCanvasCtx = null;
    embeddedWaterfallCtx = null;
    setupWaterfallCanvases();
  });

  // Clean up on unload
  window.addEventListener('unload', () => {
    stopWaterfall();
  });
}

// Start the application
init();
