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

---

## Architecture

- **Backend**
  - `Node.js` + `Express` HTTP server (`server.js`).
  - Serves static files from the `public` directory.
  - Uses `ws` (WebSocket) to keep all clients in sync with:
    - Backlog contents.
    - Who is the audio client.
    - Current CW configuration.

- **Frontend**
  - Plain HTML/CSS/JS in `public/`.
  - Connects to the server via WebSocket and:
    - Sends user actions (add/remove/clear backlog, config changes, claim/release audio).
    - Plays CW tones using the browser’s Web Audio API when designated as the audio client.

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

---

## Environment & Configuration

- **PORT**
  - Default: `3000`.
  - Set on the server (or container) to change the listening port.

No authentication is built in; anyone who can reach the server can connect as a client and interact with the backlog and audio claim system.

---

## Development Notes

- **Main server file**: `server.js`
  - WebSocket message types include `addCallsign`, `removeCallsign`, `clearBacklog`, `reorderBacklog`, `claimAudio`, `releaseAudio`, `updateConfig`, `playNext`, and `callsignPlayed`.
- **Frontend logic**: `public/app.js`
  - Handles UI, WebSocket communication, and CW tone generation using the Web Audio API.

Feel free to fork and adapt this for your own contest or training workflows (e.g. adding authentication, persistence, or more advanced backlog management).