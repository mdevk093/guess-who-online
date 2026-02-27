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
- **Grace Period**: When a player disconnects, the server does *not* immediately terminate the room. Instead, it starts a 60-second `roomCleanupTimer`.
- **State Preservation**: The player's data (identity, selected character, eliminated cards) remains in the `room.players` array with a `connected: false` flag.
- **Re-identification**: When a "new" socket joins with the same `userId` (for logged-in users) or `playerName` (for guests), the server re-attaches them to their existing player object and cancels the cleanup timer.

### Data Synchronization
All critical game states (eliminated cards, current turn, guess limits) are stored in the server's `rooms` Map, ensured that a reconnected player instantly sees the board exactly as they left it.
