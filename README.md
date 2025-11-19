CW Pileup Manager
=================

Simple, browser-based web app for managing a CW (Morse code) pileup during contests or training.

Multiple operators can connect to the same server, add callsigns to a shared backlog, and **one designated client** plays the CW audio for each callsign in order using the browser’s audio APIs.

---

## Overview

- **Backlog management**: Operators type in callsigns which are added to a shared backlog.
- **Shared state**: All connected browsers see the same backlog, configuration, and connection count.
- **Single audio output client**: Exactly one browser at a time is allowed to output audio (claim/release audio with confirmation).
- **Configurable CW playback**: Adjust WPM, delay between backlog items, and dit/dah frequencies from the web UI.
- **Waterfall visualization**: Real-time audio spectrum waterfall display (0-4 kHz) using the browser microphone, broadcast to all connected clients.
- **Standard browser audio**: Uses the Web Audio API in the browser; no plugins required.

---

## Features

- **Real-time backlog**
  - Add callsigns via a simple input form.
  - See each callsign rendered both as plain text and as Morse code dots/dashes.
  - Remove single callsigns or clear the entire backlog (with confirmation).

- **CW playback**
  - Continuous playback of the backlog: the audio client will keep playing as long as there are items.
  - Displays “Now Playing” with the current callsign and its Morse representation.
  - Automatically removes a callsign from the backlog after it has been played.

- **Multi-user aware**
  - Shows the number of connected clients.
  - Shows which client currently holds audio output (you vs. another client).

- **Configurable from the web UI**
  - **Words per minute (WPM)** – CW speed.
  - **Delay between backlog items** – pause between finished callsigns.
  - **Dit tone frequency** – frequency (Hz) for dots.
  - **Dah tone frequency** – frequency (Hz) for dashes.

- **Waterfall visualization**
  - Real-time sideways waterfall display showing incoming audio spectrum (0-4 kHz).
  - Uses the browser microphone API (requires permission).
  - Only the audio output client can start the waterfall and capture microphone input.
  - Waterfall frames are automatically broadcast to all connected clients via WebSocket.
  - Available in two views:
    - **Embedded panel**: Compact waterfall display in the main manager view.
    - **Full waterfall view**: Dedicated tab with a larger waterfall display.
  - Frequency axis is vertical (0 Hz at bottom, 4 kHz at top); time scrolls left to right.

---

## Architecture

- **Backend**
  - `Node.js` + `Express` HTTP server (`server.js`).
  - Serves static files from the `public` directory.
  - Uses `ws` (WebSocket) to keep all clients in sync with:
    - Backlog contents.
    - Who is the audio client.
    - Current CW configuration.
    - Waterfall frame data (broadcast from audio client to all others).

- **Frontend**
  - Plain HTML/CSS/JS in `public/`.
  - Connects to the server via WebSocket and:
    - Sends user actions (add/remove/clear backlog, config changes, claim/release audio).
    - Plays CW tones using the browser's Web Audio API when designated as the audio client.
    - Captures microphone input and performs FFT analysis for waterfall display (audio client only).
    - Receives and renders waterfall frames broadcast from the audio client (all clients).

---

## Prerequisites

- **Node.js** 18.x or newer (LTS recommended).
- **npm** (comes with Node).
- Optional: **Docker** and **docker-compose** if you prefer running via containers.

---

## Getting Started (Local Node.js)

1. **Install dependencies**

   From the project root:

   ```bash
   npm install
   ```

2. **Start the server**

   ```bash
   npm start
   ```

   By default the server listens on port `3000` (configurable via the `PORT` environment variable).

3. **Open the web UI**

   In your browser, go to:

   ```text
   http://localhost:3000
   ```

4. **Connect multiple clients (optional)**

   - Open additional browser windows or tabs pointing at the same URL.
   - Each connected client will appear in the **Clients** counter in the UI.

---

## Running with Docker / docker-compose

This repository includes a `Dockerfile` and `docker-compose.yml` for containerized deployment.

### Build & run with docker-compose

From the project root:

```bash
docker-compose up --build
```

This will:

- Build the `cw-pileup-manager` image.
- Start the container mapped to host port `3000`.

Once running, open:

```text
http://localhost:3000
```

To stop the stack:

```bash
docker-compose down
```

---

## Using the Application

### 1. Adding callsigns

- Use the callsign input field at the top of the page.
- Type a callsign (e.g. `K1ABC`) and hit **Enter** or click the **Add**/submit button (depending on your UI).
- The callsign appears in the backlog list with:
  - Its position number.
  - The callsign text.
  - Its Morse code representation.

### 2. Managing the backlog

- **Remove a single callsign**: Click the **Remove** button next to that backlog entry.
- **Clear the backlog**: Use the **Clear Backlog** button; you’ll be asked to confirm.
- The backlog count and list update for all connected clients in real time.

### 3. Claiming audio output

- Only one browser at a time can output audio.
- On any client, click the **Claim Audio** button.
- A confirmation dialog will explain that only one client can output audio at a time; confirm to proceed.
- If successful:
  - Your UI will show `Audio: You`.
  - The **Claim Audio** button is disabled, and the **Release Audio** and playback controls are enabled.
- To give up audio, click **Release Audio**; other clients can then claim it.

### 4. Configuring CW playback

In the configuration section of the UI:

- **WPM**: Controls CW speed; valid range on the backend is roughly 5–50 WPM.
- **Delay between backlog items (ms)**: Pause between finished callsigns when playing continuously.
- **Dit frequency (Hz)** and **Dah frequency (Hz)**:
  - Valid range is approximately 200–1500 Hz.
  - Use the same or different values to taste (e.g. 600/600 Hz).

Whenever you change these values:

- The client sends an `updateConfig` message to the server.
- The server validates and updates its shared config.
- All clients receive and reflect the new configuration.

### 5. Playing callsigns

- After claiming audio:
  - Click **Play All** to enable continuous playback of the backlog.
  - The button toggles to **Disable Playback** while playback is enabled.
- The app:
  - Takes the next callsign in the backlog.
  - Plays it as Morse using the current WPM and frequencies.
  - Notifies the server when the callsign is done, which removes it from the backlog.
  - Waits the configured delay before moving to the next item.
- You can click **Stop** to stop continuous playback while keeping your audio role.

### 6. Using the waterfall

- **Starting the waterfall** (audio client only):
  - First, claim audio output (see step 3 above).
  - Navigate to the **Waterfall** tab or view the embedded waterfall panel in the main view.
  - Click **Start Waterfall**.
  - Grant microphone permission when prompted by your browser.
  - The waterfall will begin displaying in real-time, showing incoming audio frequencies from 0-4 kHz.

- **Viewing the waterfall** (all clients):
  - **Embedded panel**: A compact waterfall display appears in the main manager view below the "Now Playing" section.
  - **Full waterfall view**: Click the **Waterfall** tab in the navigation to see a larger, dedicated waterfall display.
  - Non-audio clients automatically receive and display waterfall frames broadcast from the audio client.
  - The waterfall shows frequency on the vertical axis (0 Hz at bottom, 4 kHz at top) and time scrolling left to right.

- **Stopping the waterfall**:
  - Click **Stop Waterfall** on the audio client.
  - This releases the microphone and stops broadcasting frames to other clients.

---

## Environment & Configuration

- **PORT**
  - Default: `3000`.
  - Set on the server (or container) to change the listening port.

No authentication is built in; anyone who can reach the server can connect as a client and interact with the backlog and audio claim system.

---

## Development Notes

- **Main server file**: `server.js`
  - WebSocket message types include `addCallsign`, `removeCallsign`, `clearBacklog`, `reorderBacklog`, `claimAudio`, `releaseAudio`, `updateConfig`, `playNext`, `callsignPlayed`, and `waterfallFrame`.
- **Frontend logic**: `public/app.js`
  - Handles UI, WebSocket communication, and CW tone generation using the Web Audio API.
  - Implements waterfall visualization using `AnalyserNode` for FFT analysis (2048-point FFT, limited to 0-4 kHz display).
  - Broadcasts downsampled waterfall frames (~20 FPS) from the audio client to all connected clients.

Feel free to fork and adapt this for your own contest or training workflows (e.g. adding authentication, persistence, or more advanced backlog management).