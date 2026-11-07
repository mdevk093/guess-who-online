# Pre-Auth & Pre-Paid-Tier Gameplay & UX Polish Specification

This document details all high-priority gameplay fixes, lobby management features, and quality-of-life (QoL) improvements to implement **before** shifting focus to account authentication, password recovery, and paid-tier features.

---

## Summary Table

| ID | Feature / Fix | Priority | Status | Target Files |
| :--- | :--- | :--- | :--- | :--- |
| **NFR-SEC-07** | Server Root Directory Exposure Hardening | Critical | `[Implemented]` | `server/index.js` |
| **FR-ROOM-08** | Inactive Match Cancellation (3-Minute Inactivity Auto-Abort) | High | `[Implemented]` | `socketHandler.js`, `GameContext.jsx`, `CharacterSelect.jsx` |
| **FR-CHAT-07** | Auto-Scroll Chat to Bottom on New Messages | High | `[Implemented]` | `Chat.jsx`, `GameBoard.jsx` |
| **FR-CHAT-06** | Decode HTML Entities (`&#39;`, `&quot;`) in Chat & Player Names | High | `[Planned]` | `Chat.jsx`, `GameBoard.jsx`, `CharacterSelect.jsx` |
| **FR-GAME-09** | "Main Menu" / Leave Button on Victory & Defeat (`GAME_OVER`) Modal | High | `[Implemented]` | `GameBoard.jsx` |
| **NFR-REL-04** | 20-Second Disconnect Countdown UI & Turn Timer Pause on Disconnect | High | `[Implemented]` | `GameBoard.jsx`, `socketHandler.js` |
| **FR-ROOM-07** | Host "Kick Player" Action in Pre-Game Lobbies | High | `[Implemented]` | `CharacterSelect.jsx`, `GameContext.jsx`, `socketHandler.js` |
| **NFR-UX-04** | Mid-Match Quit / Leave Confirmation Modal | Medium | `[Implemented]` | `GameBoard.jsx`, `CharacterSelect.jsx` |
| **NFR-UX-05** | Persistent Audio Mute / Unmute Toggle (`🔊 / 🔇`) | Medium | `[Planned]` | `GameContext.jsx`, `GameBoard.jsx`, `CharacterSelect.jsx` |
| **NFR-UX-06** | "How to Play" Interactive Rules Modal | Medium | `[Planned]` | `Landing.jsx`, `GameBoard.jsx` |

> [!NOTE]
> **Dynamic Card Randomization** has been assigned to the **Paid Tier / Premium Features** (`FR-DECK-07`) so paid users hosting matches with large pools (e.g. 50+ countries or custom photo libraries) can subsample 24 random cards per round.

---

## 1. High-Priority Gameplay & Bug Fixes

### 1.1 Secure Server Static Directory Exposure (`NFR-SEC-07`)
- **Problem**: In `server/index.js`, line 28 currently serves `express.static(__dirname)`. In production, serving the root `server/` directory allows external users to request sensitive backend files directly via HTTP (e.g. `https://<domain>/.env`, `https://<domain>/handlers/socketHandler.js`, or `https://<domain>/db.js`).
- **Specification**:
  - Remove `app.use(express.static(__dirname))`.
  - Expose only the specific public assets needed by clients:
    ```javascript
    app.use('/public', express.static(path.join(__dirname, 'public')));
    app.get('/defaultCharacters.json', (req, res) => {
        res.sendFile(path.join(__dirname, 'defaultCharacters.json'));
    });
    ```
- **Affected Locations**:
  - `server/index.js`

---

### 1.2 Dynamic Card Deck Randomization (`FR-CFG-06`)
- **Problem**: Presets like Countries or Classic may contain a large pool of items (e.g., 50+ countries). Currently, if a preset has more than 24 cards, either only the first 24 are shown or the board overflows, and every match plays with the exact same subset of cards.
- **Specification**:
  - A preset deck can have a master pool of **N cards** (e.g. 50+ countries, Marvel characters, etc.).
  - When a game starts (`start_game`) or when players choose to play again (`restart_game` / rematch):
    - The server dynamically performs a Fisher-Yates shuffle on the selected master preset pool.
    - Exactly **24 cards** are sampled from the pool and synchronized across both players as the active board deck for that match.
    - Each rematch automatically draws a fresh, randomized combination of 24 cards, providing high replayability.
- **Affected Locations**:
  - `server/handlers/socketHandler.js` (inside `start_game` and `restart_game`).
  - `client/src/components/CharacterSelect.jsx` (ensures host preview handles dynamic pools cleanly).

---

### 1.3 Inactive Match Cancellation / 4-Minute Auto-Abort (`FR-ROOM-08`)
- **Problem**: If both players abandon an active match or stop interacting without clicking "Leave Room" (e.g. neither player sends a chat, flips cards, makes a guess, or advances turns), the room sits idle in memory indefinitely and blocks the players until they close their tabs.
- **Specification**:
  - The server tracks a rolling `lastActivityTimestamp` per room.
  - Any user interaction resets this inactivity timer:
    - Sending a chat message (`send_message`)
    - Eliminating or restoring cards on the board (`update_eliminated_count`)
    - Submitting a guess (`make_guess`)
    - Selecting or locking a character in pre-game (`select_character`, `lock_character`)
    - Ending turn (`end_turn`)
  - If a room experiences **zero activity for 4 minutes (240 seconds)** during `SELECTING` or `PLAYING`, the server automatically terminates the match (`room_terminated` with reason `"Room closed due to 4 minutes of inactivity"`), clears the room from memory, and returns connected players to the home screen.
- **Affected Locations**:
  - `server/handlers/socketHandler.js`
- **Implementation Plan**:
  - Add an inactivity timer (`inactivityTimer`) to each room that resets on every gameplay/chat socket event.
  - If the timer reaches 4 minutes without any action, broadcast `room_terminated` with an inactivity explanation, clean up room timers and Maps.

---

### 1.2 Auto-Scroll Chat to Bottom on New Messages (`FR-CHAT-07`)
- **Problem**: When players send or receive messages in the chat container, the view does not automatically scroll down to the newest message. Users currently have to manually scroll down to see incoming messages and system announcements.
- **Affected Locations**:
  - `client/src/components/Chat.jsx` (desktop/tablet sidebar chat).
  - `client/src/components/GameBoard.jsx` (mobile chat tab view).
- **Implementation Plan**:
  - Add a dedicated dummy scroll anchor `div` (`messagesEndRef`) at the bottom of the messages list.
  - Implement a `useEffect` triggered whenever the messages array updates (`messages.length`), calling `messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })` (or instant scroll if already near bottom) so latest messages are always in view without manual scrolling.

---

### 1.3 Fix Apostrophes & Quotes (`&#39;` / `&quot;`) Showing in Chat & Names (`FR-CHAT-06`)
- **Problem**: On the server, `sanitizeInput()` in `server/handlers/socketHandler.js` encodes special characters (`'`, `"`, `&`, `<`, `>`) into HTML entities (`&#39;`, `&quot;`, `&amp;`, `&lt;`, `&gt;`) to sanitize incoming payloads. Because React automatically escapes rendered text strings in JSX, raw HTML entities like `Don&#39;t` or `Player&#39;s` are displayed literally to users.
- **Affected Locations**:
  - `client/src/components/Chat.jsx` — Chat message text (`msg.text`) and sender names (`msg.senderName`).
  - `client/src/components/GameBoard.jsx` — Mobile/sidebar chat message text (`msg.text`), sender names (`msg.senderName`), system divider labels (`msg.text`), and opponent header names (`opponent.name`).
  - `client/src/components/CharacterSelect.jsx` — Lobby player tags (`p.name`).
- **Implementation Plan**:
  - Import and apply `decodeHtmlEntity()` from `client/src/utils/helpers.js` wherever server-sanitized player names or chat messages are rendered in JSX.

---

### 1.4 Add "Leave to Main Menu" Button on the Game Over Screen (`FR-GAME-09`)
- **Problem**: When a game concludes (`room.state === 'GAME_OVER'`), the full-screen victory/defeat overlay in `client/src/components/GameBoard.jsx` only presents a **"Play Again"** button (`restartGame`). Players who matched via the Public Lobbies browser and want to return to the home screen after one match have no direct exit button on the modal.
- **Affected Locations**:
  - `client/src/components/GameBoard.jsx` (lines 365–426, `GAME_OVER` overlay).
- **Implementation Plan**:
  - Add a secondary **"Main Menu"** button alongside **"Play Again"** inside the `GAME_OVER` modal that invokes `leaveRoom()`, cleanly disconnecting the player from the room and resetting the URL from `?room=CODE` to `/`.

---

### 1.5 20-Second Disconnect Countdown & Pause Turn Timer (`NFR-REL-04`)
- **Problem**:
  1. When an opponent refreshes or loses connection during `SELECTING` or `PLAYING`, `GameBoard.jsx` displays an *"Opponent Disconnected"* modal, but gives no indication of how much time remains before the 20-second server grace period (`roomCleanupTimers` in `server/handlers/socketHandler.js`) expires.
  2. While the opponent is disconnected (`opponent.connected === false`), the active turn countdown timer in `GameBoard.jsx` continues ticking down to `0` in the background.
- **Affected Locations**:
  - `client/src/components/GameBoard.jsx` (turn timer `useEffect` and Opponent Disconnected modal).
  - `server/handlers/socketHandler.js` (optional `disconnectedAt` timestamp on the player or room state).
- **Implementation Plan**:
  - Pause the local turn countdown interval in `GameBoard.jsx` whenever `opponent && !opponent.connected`.
  - Display a live **20s → 0s** visual countdown inside the *"Opponent Disconnected"* overlay so the remaining player knows exactly when the room will automatically close if their opponent does not return.

---

### 1.6 Host "Kick Player" Option in Lobbies (`FR-ROOM-07`)
- **Problem**: With Public Lobbies enabled (`FR-ROOM-04`), any user can join an open 1-player lobby from the lobby browser. If a joining player goes AFK in `CharacterSelect.jsx` without locking in a secret character, the Host cannot start the match and is forced to abandon their own room.
- **Affected Locations**:
  - `server/handlers/socketHandler.js` — Add `kick_player` socket event handler.
  - `client/src/context/GameContext.jsx` — Add `kickPlayer(targetPlayerId)` action and handle `player_kicked` client event.
  - `client/src/components/CharacterSelect.jsx` — Add a small **Kick (`✕`)** button next to the non-host player's name badge (visible only to the Host).
- **Implementation Plan**:
  - Server verifies `socket.id === room.hostId` and `room.state === 'SELECTING'`.
  - Removes the non-host player from `room.players`, resets host's ready state if needed, emits `player_kicked` to the removed socket (returning them to `Landing.jsx` with a notification), and broadcasts updated room/public-lobby lists.

---

## 2. Quality-of-Life & Polish Features

### 2.1 Mid-Match Quit Confirmation Modal (`NFR-UX-04`)
- **Problem**: Clicking the red exit icon in the top-left corner of `GameBoard.jsx` immediately calls `leaveRoom()`, destroying the active game for both players without warning. On mobile viewports, this button sits close to the header status controls and is easy to tap accidentally.
- **Affected Locations**:
  - `client/src/components/GameBoard.jsx` (top-left Leave button).
- **Implementation Plan**:
  - Replace the immediate `onClick={leaveRoom}` action during `PLAYING` with `onClick={() => setShowLeaveConfirm(true)}`.
  - Render a compact confirmation modal (*"Leave Active Match? Leaving now will end the game for both players."*) with **Stay in Game** and **Leave Match** buttons.

---

### 2.2 Mute / Unmute Sound Toggle (`🔊 / 🔇`) (`NFR-UX-05`)
- **Problem**: The game synthesizes Web Audio API sound effects for lobby joins (`playJoinSound` in `GameContext.jsx`), turn start alerts (`playPing` in `GameBoard.jsx`), and low-time countdown ticks (`playTick` in `GameBoard.jsx`), with no way for players to mute game audio.
- **Affected Locations**:
  - `client/src/context/GameContext.jsx` — Manage `isMuted` boolean state persisted in `localStorage.getItem('sound_muted')`.
  - `client/src/components/GameBoard.jsx` & `client/src/components/CharacterSelect.jsx` — Add a compact `🔊 / 🔇` toggle button in the top navigation bar and check `isMuted` before playing any Web Audio synthesizer cue.

---

### 2.3 "How to Play" Quick Rules Modal (`NFR-UX-06`)
- **Problem**: First-time visitors arriving on `Landing.jsx` (especially via shared `?room=CODE` invite links) have no built-in rules guide explaining how turns, chat questions, card flipping, and high-stakes character guessing work.
- **Affected Locations**:
  - `client/src/components/Landing.jsx` — Add a **"How to Play"** button below the main action buttons.
  - `client/src/components/GameBoard.jsx` — Optional `?` help icon in the header.
- **Implementation Plan**:
  - Create a clean modal illustrating the 4 core steps:
    1. **Pick Your Secret Character**: Lock in one character from the board that your opponent must deduce.
    2. **Ask Yes / No Questions**: Use the live chat on your turn to narrow down possibilities (*"Does your character wear glasses?"*).
    3. **Flip Cards to Eliminate**: Click cards on your board to flip down suspects you have ruled out.
    4. **Make Your Final Guess**: Click **"Guess Opponent"** when confident—a correct guess wins immediately, while a wrong guess eliminates that suspect and ends your turn.
