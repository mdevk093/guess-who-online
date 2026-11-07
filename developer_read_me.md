# Developer Readme - Security & Resilience

This document outlines the technical implementations for security, rate limiting, and session resilience in the Guess Who Online application.

## 🛡️ Security: Socket Rate Limiting

To prevent abuse and ensure server stability, we have implemented a categorical rate-limiting system on the server side.

### Implementation Details
- **Location**: `server/handlers/socketHandler.js`
- **Mechanism**: A `lastEventTimestamps` Map tracks the last successful event per `socket.id` and category.
- **Logic**: The `checkRateLimit(socketId, category, limitMs)` helper function validates if enough time has passed since the last event in that category. If not, the event is silently ignored by the server.

### Rate Limit Categories

| Category | Limit (ms) | Frequency | Description |
| :--- | :--- | :--- | :--- |
| **Chat** | 1000ms | 1/sec | Prevents spamming game chat. |
| **Guess** | 1000ms | 1/sec | Prevents brute-force guessing and floods. |
| **Game Action** | 500ms | 2/sec | Covers restarts, selections, and ending turns. |
| **Typing** | 200ms | 5/sec | Throttles typing indicators while keeping them fluid. |

---

## 👮 Chat Moderation & Safety

To comply with App Store policies (Apple Section 1.2), we have implemented foundational chat moderation tools.

### Profanity Filter
- **Mechanism**: Server-side filtering in `socketHandler.js` using the `filterProfanity(text)` helper.
- **Action**: Matches common offensive terms using regex boundaries (`\bword\b`) and replaces them with asterisks (`****`) to match the word length.
- **Scope**: Filtering is applied to every message text before it is broadcast to other players.

#### 📝 How to Extend the Filter
To add new words to the filter:
1. Open [socketHandler.js](file:///Users/manishdevkota/.gemini/antigravity/scratch/guess-who-online/server/handlers/socketHandler.js).
2. Find the `PROFANITY_LIST` array (around line 23).
3. Add your new words as strings to the array:
   ```javascript
   const PROFANITY_LIST = ['word1', 'word2', 'your_new_word'];
   ```
4. Save the file and restart the server.

### User Reporting System
- **Reporting Workflow**:
    1. A player hovers over an opponent's message in the chat.
    2. A "flag" icon appears, allowing the player to report the message.
    3. After confirmation, the client emits a `report_user` event to the server.
- **Server Logging**:
    - The server captures the reported message, the reporter's name, the room ID, and the reported user's ID/name.
    - Reports are logged to the console for immediate visibility.
    - Reports are inserted into a `reports` table in Supabase for long-term record keeping and review.

---

## 🛡️ Frontend Resilience: Error Boundaries

To prevent total application failure (the "white screen of death"), we use a custom Error Boundary.

### How it Works
- **Location**: `client/src/components/ErrorBoundary.jsx`
- **Scope**: Wrapped around the entire `GameRouter` in `App.jsx`.
- **Catching Crashes**: It intercepts JavaScript errors anywhere in the component tree, preventing them from unmounting the whole React app.
- **Graceful Fallback**: Instead of crashing, it displays a theme-appropriate "Game Glitched!" screen.
- **Data Safety**: Since game state is managed via `GameProvider` and server-side sockets, a simple refresh (triggered by the "Quick Refresh" button) usually restores the player to their exact previous state without losing game progress.

---

## 🔄 Lobby Resilience & Reconnection

The game is designed to be "refresh-proof," allowing players to stay in their lobby even if they accidentally reload their browser or lose connection briefly.

### Client-Side Persistence (`FR-ROOM-05` & `NFR-REL-01`)
- **Per-Tab & Browser Memory**: `GameContext.jsx` automatically stores `last_room_id` and `player_name` in both `sessionStorage` (prioritized per-tab so multi-tab local testing doesn't overwrite player identities) and `localStorage` (as a fallback).
- **Socket Connect Auto-Rejoin**: Directly inside the `newSocket.on('connect')` listener (`attemptAutoRejoin`), `GameContext` checks for stored credentials, resolves any active Supabase JWT session, and immediately emits `join_room` so page refreshes reconnect reliably without racing React's render cycle.

### Server-Side Grace Period
- **Grace Period**: When a player disconnects, the server does *not* immediately terminate the room. Instead, it starts a 20-second `roomCleanupTimer`.
- **State Preservation**: The player's data (identity, selected character, eliminated cards) remains in the `room.players` array with a `connected: false` flag.
- **Re-identification**: When a "new" socket joins with the same `userId` (for logged-in users) or `playerName` (for guests), the server re-attaches them to their existing player object and cancels the cleanup timer.

### Data Synchronization & Eliminated Cards Persistence (`NFR-REL-02`)
All critical game states (eliminated cards, current turn, guess limits) are stored in the server's `rooms` Map and backed up in `localStorage` (`eliminated_ids_<roomId>`), ensuring that a reconnected player instantly sees their exact flipped/eliminated cards on the board as they left them:
- **Dual Persistence**: Whenever a player toggles a card (`toggleEliminate`) or makes an incorrect guess, `eliminatedIds` is saved to `localStorage` and sent to the server via `update_eliminated_count`.
- **Privacy Redaction**: `sanitizeRoomForPlayer` only sends `player.eliminatedIds` to that specific player (`p.id === recipientSocketId`), while the opponent only receives `player.eliminatedCount` (so opponents can see *how many* suspects are left, but never *which* specific cards were eliminated).
- **Lifecycle Cleanup**: Saved `eliminatedIds` are automatically cleared when a new round starts (`restart_game`, `start_playing`) or when the room is left/terminated.

---

## 🔒 Anti-Cheat & Server-Side Authorization (`NFR-SEC-03` & `NFR-SEC-04`)

### 1. Secret Character Redaction (`NFR-SEC-03`)
- **Location**: `sanitizeRoomForPlayer(room, recipientSocketId)` and `emitRoomState(io, room, eventName)` in `server/handlers/socketHandler.js`.
- **Problem Prevented**: Previously, broadcasting the raw `room` object to all sockets in a room exposed `opponent.selectedCharacter` in WebSocket network frames (inspectable via browser DevTools).
- **Mechanism**: Every state broadcast (`room_created`, `room_updated`, `game_started`, `start_playing`, `game_over`) sends an individually sanitized copy of `room` to each connected player:
  - A player always receives their own full `selectedCharacter`.
  - Their opponent's `selectedCharacter` is redacted to `{ hidden: true }` while `gameState !== 'GAME_OVER'`.
  - Once `gameState === 'GAME_OVER'`, the full character objects are revealed to both players.

### 2. Turn, Phase & Host Authorization (`NFR-SEC-04`)
- **Turn Ownership Validation**: `make_guess` and `end_turn` verify on the server that `room.players[room.turn].id === socket.id` before processing. Out-of-turn socket emissions are ignored.
- **Single Authoritative Turn Timer**: Turn timeouts are handled exclusively by the server's `startRoomTimer` in `socketHandler.js` (removing the duplicate client-side `endTurn()` trigger on timer expiry in `GameBoard.jsx` that could cause double turn skips).
- **Phase & Readiness Guards**:
  - `start_game` requires the sender to be the Host (`room.players[0].id === socket.id`) and `room.gameState === 'LOBBY'`.
  - `select_character` requires `room.gameState === 'SELECTING'` and `!player.isReady` so a locked-in character cannot be swapped mid-match.

### 3. Cryptographic Identity Verification (Anti-Spoofing)
- **Location**: `getVerifiedUserId(token)` in `server/handlers/socketHandler.js` and `create_room` / `join_room` in `client/src/context/GameContext.jsx`.
- **Mechanism**: Instead of trusting a raw `userId` string sent from the client, the client passes its Supabase `session.access_token` (JWT). The server verifies the token with `supabase.auth.getUser(accessToken)` and extracts the authentic `user.id` before recording career wins/losses or re-binding a disconnected session.

---

## 🌐 Public Rooms Browser & Lobby Audio (`FR-ROOM-04` & `FR-GAME-06`)

### 1. Public Lobbies Discovery & Filtering (`FR-ROOM-04`)
- **Location**: `getPublicRoomsList()` and `broadcastPublicRooms(io)` in `server/handlers/socketHandler.js`, `Landing.jsx`, and `CharacterSelect.jsx`.
- **Visibility Toggle**: Players can toggle a room between **Public** and **Private** before creating a room on `Landing.jsx` or dynamically inside the lobby header/settings modal via `toggle_room_public`.
- **Sorting & Filtering**:
  - Clicking **View Lobbies** on the landing screen opens the live public lobby browser.
  - `getPublicRoomsList()` returns all active public lobbies and automatically sorts open 1-player lobbies (`isFull: false`) to the top above full/in-progress lobbies.
  - Players can click **Hide Full / ✓ Open Only** to filter out full rooms and click **Join** next to any open lobby.

### 2. Lobby Join Audio Notification (`FR-GAME-06`)
- **Location**: `playJoinSound` in `client/src/context/GameContext.jsx` and `player_joined_sound` in `server/handlers/socketHandler.js`.
- **Mechanism**: When a second player joins a lobby, the server emits `player_joined_sound` to the room, triggering a two-tone Web Audio API chime (`C5 → G5`).

---

## 🔒 Static Asset Directory Exposure Hardening (`NFR-SEC-07`)

- **Vulnerability**: Previously, `server/index.js` included `app.use(express.static(__dirname))`. In production, serving the entire `server/` root exposed sensitive server files (e.g. `db.js`, `handlers/socketHandler.js`, `package.json`, `crop_characters.js`) to direct HTTP GET requests.
- **Remediation**:
  - Removed `express.static(__dirname)`.
  - Whitelisted only the necessary client endpoints:
    - `app.use('/public', express.static(path.join(__dirname, 'public')))` (game character portraits and classic/flag PNGs).
    - `app.use('/uploads', express.static(path.join(__dirname, 'uploads')))` (custom character uploads).
    - `app.get('/defaultCharacters.json', (req, res) => res.json(defaultCharacters))` (default avatar character definitions).
    - `app.get('/presets', (req, res) => res.json(presets))` (preset themes).
  - All other root server files now respond with HTTP 404 (`Cannot GET /file`).

---

## 📋 Changelog of Recent Fixes & Commits

| Date | Commit / Scope | Summary of Changes |
| :--- | :--- | :--- |
| **2026-11-07** | UI/UX Redesign (`Landing.jsx`, `CharacterSelect.jsx`, `GameBoard.jsx`, `Chat.jsx`, `Auth.jsx`, `index.css`) | • Applied the **Modern Clean Studio (Light Slate & Electric Azure)** theme and layout across the entire application.<br>• **Lobby & Game Mode Selection (`CharacterSelect.jsx`)**: Replaced the hidden settings modal and `<select>` dropdown with an inline **Configure Match & Select Theme** lobby featuring interactive **Visual Theme Deck** cards, collapsible suspect deck preview, side-by-side **Lobby Players** cards with Host **Kick** action, and inline **Turn Timer** (`Off`, `1m`, `2m`, `3m`) & **Guess Limit** (`∞ Unlimited`, `3`, `1 Sudden Death`) controls. Redesigned the `SELECTING` phase into a 12-column grid with a sticky player status and secret suspect lock-in sidebar.<br>• **Deduction Chat HUD (`Chat.jsx`)**: Added sender avatar badges (`ME` and opponent initials), grouped consecutive messages from the same sender so the `ME`/sender badge and header only appear on the first message in a streak, and added one-tap **Quick Reply** chips (`👍 Yes`, `👎 No`, `🤔 Maybe / Unclear`).<br>• **Game Board (`GameBoard.jsx`)**: Redesigned the top match header bar with opponent status pill, active turn pill, timer/guess counters, and a 12-column board + chat layout with a persistent **Your Secret Character** bottom tray. |
| **2026-11-06** | `NFR-SEC-07`, `FR-CHAT-07`, `FR-GAME-09`, `FR-ROOM-06`, `FR-ROOM-07`, `NFR-UX-04`, `NFR-REL-04` & `FR-ROOM-08` | • **(`NFR-SEC-07`)** Hardened server static directory exposure: removed `app.use(express.static(__dirname))` from `server/index.js` and explicitly whitelisted only `/public`, `/uploads`, `/presets`, and `/defaultCharacters.json`.<br>• **(`FR-CHAT-07`)** Fixed chat auto-scrolling in `Chat.jsx` and `GameBoard.jsx` using direct container `scrollTop = scrollHeight` inside `requestAnimationFrame`, bounded flex heights (`min-h-0`, `sm:h-[45vh] lg:h-full`), re-scrolling on typing indicator or mobile drawer open, and formatted message timestamps as `HH:MM` without seconds.<br>• **(`FR-GAME-09` & `FR-ROOM-06`)** Added a **Main Menu** exit button (`leaveRoom`) on the Victory / Game Over modal in `GameBoard.jsx` and updated `leave_room` in `socketHandler.js` to use `socket.to(roomId).emit('room_terminated', ...)` so only the remaining opponent is notified when a player leaves.<br>• **(`FR-ROOM-07`)** Added Host **Kick** button in `CharacterSelect.jsx` (`kick_player` in `socketHandler.js` & `GameContext.jsx`) so hosts can remove AFK players during `LOBBY` or `SELECTING` without destroying the room.<br>• **(`NFR-UX-04`)** Added quit confirmation modal (`showLeaveConfirm`) in `GameBoard.jsx` and `CharacterSelect.jsx` before leaving an active match or 2-player lobby.<br>• **(`NFR-REL-04`)** Paused server & client turn timers while an opponent is disconnected (resuming from the exact remaining time on reconnect) and added a live 20-second visual countdown and progress bar inside the Opponent Disconnected modal (`GameBoard.jsx`, `socketHandler.js`).<br>• **(`FR-ROOM-08`)** Implemented 3-minute (`180000ms`) room inactivity auto-abort (`resetInactivityTimer` in `socketHandler.js`) that resets on chats, typing, guesses, card eliminations, character selections, and turn changes, and terminates rooms idle for 3 minutes. |
| **2026-11-06** | `FR-ROOM-03` & `NFR-UX-02` | • Synced browser address bar URL to `?room=CODE` upon creating or joining a room (`GameContext.jsx`), preserved `?room=CODE` on invite links (`Landing.jsx`), and reset URL to `/` on room exit or termination. |
| **2026-11-06** | `9860f9d` (`FR-ROOM-04` & `FR-GAME-06`) | • Implemented **View Lobbies** browser in `Landing.jsx` showing live public lobbies with open lobbies sorted to the top and a **Hide Full** filter toggle.<br>• Added Public/Private room toggles on room creation (`Landing.jsx`) and inside the lobby (`CharacterSelect.jsx` via `toggle_room_public`).<br>• Added Web Audio API lobby join chime (`playJoinSound` on `player_joined_sound`). |
| **2026-11-06** | `4e9c6be` (`NFR-REL-01`, `NFR-REL-02` & `FR-ROOM-05`) | • Persisted `eliminatedIds` across both server player state and `sessionStorage`/`localStorage` (`eliminated_ids_<roomId>`) so browser refreshes restore flipped cards.<br>• Fixed auto-rejoin race condition on page refresh by triggering `attemptAutoRejoin` directly inside `newSocket.on('connect')` and isolating per-tab `player_name` via `sessionStorage`.<br>• Redacted opponent's `eliminatedIds` array in `sanitizeRoomForPlayer` so opponents only see `eliminatedCount`.<br>• Auto-recorded wrong guess eliminations server-side and cleared stale `eliminatedIds` on rematch/room exit. |
| **2026-11-06** | `6034bb2` (`NFR-SEC-03` & `NFR-SEC-04`) | • Added `sanitizeRoomForPlayer` & `emitRoomState` to redact opponent's secret character from WebSocket payloads until `GAME_OVER`.<br>• Enforced server-side active-turn checks on `make_guess` and `end_turn`.<br>• Verified Supabase `access_token` JWTs server-side on `create_room` and `join_room` to prevent `userId` spoofing.<br>• Removed duplicate client-side turn-end trigger on timer expiration in `GameBoard.jsx`. |
| **2026-11-06** | `37c25c2` | • Reduced player disconnection grace period (`roomCleanupTimer`) from 60 seconds to **20 seconds**. |
| **2026-11-06** | `e375cc0` | • Consolidated UI updates across `Landing.jsx`, `CharacterSelect.jsx`, `GameBoard.jsx`, `Chat.jsx`, `Auth.jsx`, and `GameContext.jsx`. |
