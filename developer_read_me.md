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

### Client-Side Persistence
- **Lobby Memory**: `GameContext.jsx` automatically stores the `last_room_id` and `player_name` in the browser's `localStorage`.
- **Auto-Rejoin**: Upon mounting or re-connecting, the `GameContext` checks for these stored values and automatically sends a `join_room` event to the server.

### Server-Side Grace Period
- **Grace Period**: When a player disconnects, the server does *not* immediately terminate the room. Instead, it starts a 20-second `roomCleanupTimer`.
- **State Preservation**: The player's data (identity, selected character, eliminated cards) remains in the `room.players` array with a `connected: false` flag.
- **Re-identification**: When a "new" socket joins with the same `userId` (for logged-in users) or `playerName` (for guests), the server re-attaches them to their existing player object and cancels the cleanup timer.

### Data Synchronization
All critical game states (eliminated cards, current turn, guess limits) are stored in the server's `rooms` Map, ensured that a reconnected player instantly sees the board exactly as they left it.

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

## 📋 Changelog of Recent Fixes & Commits

| Date | Commit / Scope | Summary of Changes |
| :--- | :--- | :--- |
| **2026-11-06** | `NFR-SEC-03` & `NFR-SEC-04` | • Added `sanitizeRoomForPlayer` & `emitRoomState` to redact opponent's secret character from WebSocket payloads until `GAME_OVER`.<br>• Enforced server-side active-turn checks on `make_guess` and `end_turn`.<br>• Verified Supabase `access_token` JWTs server-side on `create_room` and `join_room` to prevent `userId` spoofing.<br>• Removed duplicate client-side turn-end trigger on timer expiration in `GameBoard.jsx`. |
| **2026-11-06** | `37c25c2` | • Reduced player disconnection grace period (`roomCleanupTimer`) from 60 seconds to **20 seconds**. |
| **2026-11-06** | `e375cc0` | • Consolidated UI updates across `Landing.jsx`, `CharacterSelect.jsx`, `GameBoard.jsx`, `Chat.jsx`, `Auth.jsx`, and `GameContext.jsx`. |
