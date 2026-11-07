const { supabase } = require('../db');
const rooms = new Map();
const roomTimers = new Map();
const roomCleanupTimers = new Map(); // For reconnection grace period
const roomInactivityTimers = new Map(); // For 3-minute inactivity auto-abort (FR-ROOM-08)
const INACTIVITY_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes
const lastEventTimestamps = new Map(); // For rate limiting: socket.id -> { category -> timestamp }

function checkRateLimit(socketId, category, limitMs) {
    const now = Date.now();
    if (!lastEventTimestamps.has(socketId)) {
        lastEventTimestamps.set(socketId, {});
    }
    const timestamps = lastEventTimestamps.get(socketId);
    const lastTime = timestamps[category] || 0;

    if (now - lastTime < limitMs) {
        return false;
    }

    timestamps[category] = now;
    return true;
}

const PROFANITY_LIST = ['abuse', 'asshole', 'bitch', 'fuck', 'nigger', 'shit', 'slut', 'whore', 'faggot']; // Basic list

function filterProfanity(text) {
    if (!text || typeof text !== 'string') return text;
    let filtered = text;
    PROFANITY_LIST.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        filtered = filtered.replace(regex, (match) => '*'.repeat(match.length));
    });
    return filtered;
}

function sanitizeInput(str, maxLength) {
    if (!str || typeof str !== 'string') return '';
    // HTML Encode basic characters to prevent XSS
    let sanitized = str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    // Truncate to prevent payload size abuse
    if (maxLength && sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength);
    }
    return sanitized;
}

function getPublicRoomsList() {
    const publicRooms = [];
    rooms.forEach((room) => {
        if (room.isPublic) {
            const connectedPlayers = room.players.filter(p => p.connected);
            const playerCount = connectedPlayers.length;
            if (playerCount > 0) {
                publicRooms.push({
                    roomId: room.id,
                    hostName: room.players[0]?.name || 'Host',
                    playerCount,
                    maxPlayers: 2,
                    isFull: playerCount >= 2 || (room.gameState !== 'LOBBY' && room.gameState !== 'SELECTING'),
                    gameState: room.gameState
                });
            }
        }
    });

    // Sort open lobbies (not full & in LOBBY) to the top
    publicRooms.sort((a, b) => {
        if (a.isFull !== b.isFull) {
            return a.isFull ? 1 : -1;
        }
        return 0;
    });

    return publicRooms;
}

function broadcastPublicRooms(io) {
    io.emit('public_rooms_update', getPublicRoomsList());
}

/**
 * Returns a copy of the room state customized for a specific recipient socket.
 * Redacts the opponent's selectedCharacter until GAME_OVER (NFR-SEC-03).
 */
function sanitizeRoomForPlayer(room, recipientSocketId) {
    if (!room) return room;
    const isGameOver = room.gameState === 'GAME_OVER';
    return {
        ...room,
        players: room.players.map(p => ({
            ...p,
            selectedCharacter: (isGameOver || p.id === recipientSocketId)
                ? p.selectedCharacter
                : (p.selectedCharacter ? { hidden: true } : null),
            eliminatedIds: (p.id === recipientSocketId) ? (p.eliminatedIds || []) : undefined
        }))
    };
}

/**
 * Emits a room event to every connected player in the room with their
 * individually sanitized room payload.
 */
function emitRoomState(io, room, eventName = 'room_updated') {
    if (!room) return;
    room.players.forEach(p => {
        if (p.connected) {
            io.to(p.id).emit(eventName, sanitizeRoomForPlayer(room, p.id));
        }
    });
}

/**
 * Verifies a Supabase JWT access token on the server to prevent userId spoofing (NFR-SEC-04).
 */
async function getVerifiedUserId(token) {
    if (!token || typeof token !== 'string') return null;
    try {
        const { data, error } = await supabase.auth.getUser(token);
        if (error || !data?.user) return null;
        return data.user.id;
    } catch (err) {
        console.error('Error verifying user token:', err);
        return null;
    }
}

function clearRoomTimer(roomId) {
    if (roomTimers.has(roomId)) {
        clearTimeout(roomTimers.get(roomId));
        roomTimers.delete(roomId);
    }
}

function clearInactivityTimer(roomId) {
    if (roomInactivityTimers.has(roomId)) {
        clearTimeout(roomInactivityTimers.get(roomId));
        roomInactivityTimers.delete(roomId);
    }
}

/**
 * Resets the 3-minute inactivity timer for a room (FR-ROOM-08).
 * If no chats, guesses, card flips, or selections occur for 3 minutes, the room is terminated.
 */
function resetInactivityTimer(io, roomId) {
    clearInactivityTimer(roomId);
    const room = rooms.get(roomId);
    if (!room) return;
    room.lastActivityAt = Date.now();

    const timeout = setTimeout(() => {
        const currentRoom = rooms.get(roomId);
        if (!currentRoom) return;

        io.to(roomId).emit('room_terminated', 'Game cancelled due to 3 minutes of inactivity.');
        rooms.delete(roomId);
        clearRoomTimer(roomId);
        clearInactivityTimer(roomId);
        if (roomCleanupTimers.has(roomId)) {
            clearTimeout(roomCleanupTimers.get(roomId));
            roomCleanupTimers.delete(roomId);
        }
        console.log(`Room ${roomId} terminated due to 3 minutes of inactivity.`);
        broadcastPublicRooms(io);
    }, INACTIVITY_TIMEOUT_MS);

    roomInactivityTimers.set(roomId, timeout);
}

function startRoomTimer(io, roomId, customLimitMs = null) {
    clearRoomTimer(roomId);
    const room = rooms.get(roomId);
    if (!room || room.gameState !== 'PLAYING' || !room.settings?.timerLimit) return;

    const fullLimitMs = room.settings.timerLimit * 60 * 1000;
    const limitMs = (customLimitMs !== null && customLimitMs !== undefined) ? customLimitMs : fullLimitMs;
    room.turnRemainingMs = limitMs;
    room.turnPausedAt = null;

    const timeout = setTimeout(() => {
        const currentRoom = rooms.get(roomId);
        if (!currentRoom || currentRoom.gameState !== 'PLAYING') return;

        const nextTurn = (currentRoom.turn + 1) % currentRoom.players.length;
        const nextPlayer = currentRoom.players[nextTurn];

        currentRoom.turn = nextTurn;
        currentRoom.turnStartTime = Date.now();
        currentRoom.turnRemainingMs = fullLimitMs;
        currentRoom.turnPausedAt = null;

        const msgData = {
            type: 'DIVIDER',
            text: `Time's up! It's now ${nextPlayer.name}'s turn.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        currentRoom.chat.push(msgData);

        emitRoomState(io, currentRoom, 'room_updated');

        // Start timer for the next player
        startRoomTimer(io, roomId);
    }, limitMs);

    roomTimers.set(roomId, timeout);
}

function handleSocketEvents(io, socket) {
    // Get Public Rooms
    socket.on('get_public_rooms', () => {
        if (!checkRateLimit(socket.id, 'get_public_rooms', 500)) return;
        socket.emit('public_rooms_update', getPublicRoomsList());
    });

    // Toggle Room Public/Private Visibility (FR-ROOM-04)
    socket.on('toggle_room_public', ({ roomId, isPublic }) => {
        if (!checkRateLimit(socket.id, 'game_action', 300)) return;
        const room = rooms.get(roomId);
        if (room && room.players[0]?.id === socket.id) {
            room.isPublic = Boolean(isPublic);
            resetInactivityTimer(io, roomId);
            emitRoomState(io, room, 'room_updated');
            broadcastPublicRooms(io);
            console.log(`Room ${roomId} visibility set to Public: ${room.isPublic}`);
        }
    });
    // Create Room
    socket.on('create_room', async ({ playerName, accessToken, isPublic = false }) => {
        if (!checkRateLimit(socket.id, 'create_room', 3000)) {
            return socket.emit('error', 'Please wait a few seconds before creating another room.');
        }
        const verifiedUserId = await getVerifiedUserId(accessToken);
        const safePlayerName = sanitizeInput(playerName, 20);
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const room = {
            id: roomId,
            isPublic,
            players: [{
                id: socket.id,
                userId: verifiedUserId, // Verified Supabase UID via JWT
                name: safePlayerName,
                isHost: true,
                selectedCharacter: null,
                eliminatedIds: [],
                eliminatedCount: 0,
                isReady: false,
                connected: true
            }],
            gameState: 'LOBBY', // LOBBY, SELECTING, PLAYING, GAME_OVER
            characters: [],
            settings: {
                timerLimit: null // null or minutes (1-5)
            },
            turnStartTime: null,
            turn: 0,
            chat: []
        };
        rooms.set(roomId, room);
        resetInactivityTimer(io, roomId);
        socket.join(roomId);
        socket.emit('room_created', { roomId, room: sanitizeRoomForPlayer(room, socket.id) });
        console.log(`Room created: ${roomId} by ${safePlayerName} (Public: ${isPublic})`);
        if (isPublic) broadcastPublicRooms(io);
    });

    // Join Room
    socket.on('join_room', async ({ roomId, playerName, accessToken }) => {
        if (!checkRateLimit(socket.id, 'join_room', 2000)) {
            return socket.emit('error', 'Please wait before joining another room.');
        }
        const verifiedUserId = await getVerifiedUserId(accessToken);
        const safeRoomId = sanitizeInput(roomId, 8).toUpperCase();
        const safePlayerName = sanitizeInput(playerName, 20);

        const room = rooms.get(safeRoomId);
        if (!room) {
            return socket.emit('error', 'Room not found');
        }

        // Check for reconnection
        const existingPlayer = room.players.find(p =>
            (verifiedUserId && p.userId === verifiedUserId) || (p.name === safePlayerName && !p.connected)
        );

        if (existingPlayer) {
            console.log(`Player ${safePlayerName} reconnected to room ${safeRoomId}`);
            existingPlayer.id = socket.id;
            existingPlayer.connected = true;
            existingPlayer.disconnectedAt = null;
            if (verifiedUserId) existingPlayer.userId = verifiedUserId; // Update verified userId if player is now logged in

            // Clear any cleanup timers for this room if both players are back
            if (room.players.every(p => p.connected)) {
                if (roomCleanupTimers.has(safeRoomId)) {
                    clearTimeout(roomCleanupTimers.get(safeRoomId));
                    roomCleanupTimers.delete(safeRoomId);
                }
                // Resume paused turn timer on reconnect (NFR-REL-04)
                if (room.gameState === 'PLAYING' && room.settings?.timerLimit && room.turnPausedAt) {
                    const fullLimitMs = room.settings.timerLimit * 60 * 1000;
                    const remainingMs = room.turnRemainingMs ?? fullLimitMs;
                    room.turnStartTime = Date.now() - (fullLimitMs - remainingMs);
                    room.turnPausedAt = null;
                    startRoomTimer(io, safeRoomId, remainingMs);
                }
            }

            socket.join(safeRoomId);
            resetInactivityTimer(io, safeRoomId);
            emitRoomState(io, room, 'room_updated');
            if (room.isPublic) broadcastPublicRooms(io);
            return;
        }

        if (room.players.length >= 2) {
            return socket.emit('error', 'Room is full');
        }

        const newPlayer = {
            id: socket.id,
            userId: verifiedUserId, // Verified Supabase UID via JWT
            name: safePlayerName,
            isHost: false,
            selectedCharacter: null,
            eliminatedIds: [],
            eliminatedCount: 0,
            isReady: false,
            connected: true
        };

        room.players.push(newPlayer);
        socket.join(safeRoomId);
        resetInactivityTimer(io, safeRoomId);
        emitRoomState(io, room, 'room_updated');
        io.to(safeRoomId).emit('player_joined_sound', { playerName: safePlayerName });
        console.log(`${safePlayerName} joined room: ${safeRoomId}`);
        if (room.isPublic) broadcastPublicRooms(io);
    });

    // Leave Room
    socket.on('leave_room', ({ roomId }) => {
        if (!checkRateLimit(socket.id, 'leave_room', 1000)) return;
        const room = rooms.get(roomId);
        if (room) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                const playerName = room.players[playerIndex].name;

                // Notify ONLY the opponent (not the player who chose to leave) and terminate the room
                socket.to(roomId).emit('room_terminated', `${playerName} has left the game.`);
                socket.leave(roomId);
                rooms.delete(roomId);
                clearRoomTimer(roomId);
                clearInactivityTimer(roomId);
                if (roomCleanupTimers.has(roomId)) {
                    clearTimeout(roomCleanupTimers.get(roomId));
                    roomCleanupTimers.delete(roomId);
                }

                console.log(`${playerName} left room: ${roomId}. Room terminated.`);
                broadcastPublicRooms(io);
            }
        }
    });

    // Host Kick Player in Pre-Game Lobby (FR-ROOM-07)
    socket.on('kick_player', ({ roomId, targetPlayerId }) => {
        if (!checkRateLimit(socket.id, 'game_action', 500)) return;
        const room = rooms.get(roomId);
        if (!room) return;

        // Only the Host can kick, and only during pre-game phases (LOBBY or SELECTING)
        const hostPlayer = room.players[0];
        if (!hostPlayer || hostPlayer.id !== socket.id || !hostPlayer.isHost) return;
        if (room.gameState !== 'LOBBY' && room.gameState !== 'SELECTING') return;
        if (!targetPlayerId || targetPlayerId === socket.id) return;

        const targetIndex = room.players.findIndex(p => p.id === targetPlayerId);
        if (targetIndex === -1) return;

        const [kickedPlayer] = room.players.splice(targetIndex, 1);

        // Notify the kicked player and remove their socket from the room
        io.to(kickedPlayer.id).emit('room_terminated', 'You were removed from the lobby by the host.');
        const targetSocket = io.sockets.sockets.get(kickedPlayer.id);
        if (targetSocket) {
            targetSocket.leave(roomId);
        }

        // Clear any pending disconnect cleanup timer for the room
        if (roomCleanupTimers.has(roomId)) {
            clearTimeout(roomCleanupTimers.get(roomId));
            roomCleanupTimers.delete(roomId);
        }

        // If the room was in SELECTING, return the Host to LOBBY and clear ready/selection state so the Host is never stranded (FR-ROOM-07)
        if (room.gameState === 'SELECTING') {
            room.gameState = 'LOBBY';
            room.characters = [];
        }
        room.players.forEach(p => {
            p.isReady = false;
            p.selectedCharacter = null;
        });

        resetInactivityTimer(io, roomId);
        emitRoomState(io, room, 'room_updated');
        console.log(`Host ${hostPlayer.name} kicked ${kickedPlayer.name} from room ${roomId}.`);
        if (room.isPublic) broadcastPublicRooms(io);
    });

    // Disconnect
    socket.on('disconnect', () => {
        lastEventTimestamps.delete(socket.id); // Clean up rate limit data
        rooms.forEach((room, roomId) => {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                const player = room.players[playerIndex];
                player.connected = false;
                player.disconnectedAt = Date.now();

                // Pause active turn timer while a player is disconnected (NFR-REL-04)
                if (room.gameState === 'PLAYING' && room.settings?.timerLimit && !room.turnPausedAt) {
                    const fullLimitMs = room.settings.timerLimit * 60 * 1000;
                    const elapsedMs = Date.now() - (room.turnStartTime || Date.now());
                    room.turnRemainingMs = Math.max(1000, fullLimitMs - elapsedMs);
                    room.turnPausedAt = Date.now();
                    clearRoomTimer(roomId);
                }

                console.log(`Player ${player.name} disconnected from room ${roomId}. Waiting for reconnection...`);
                emitRoomState(io, room, 'room_updated');

                // Start grace period cleanup
                const cleanupTimeout = setTimeout(() => {
                    const currentRoom = rooms.get(roomId);
                    if (currentRoom && !player.connected) {
                        io.to(roomId).emit('room_terminated', `${player.name} failed to reconnect.`);
                        rooms.delete(roomId);
                        clearRoomTimer(roomId);
                        clearInactivityTimer(roomId);
                        roomCleanupTimers.delete(roomId);
                        console.log(`Room ${roomId} terminated after grace period.`);
                        if (currentRoom.isPublic) broadcastPublicRooms(io);
                    }
                }, 20000); // 20 seconds grace period

                roomCleanupTimers.set(roomId, cleanupTimeout);

                // If it was a public room and a player disconnected, broadcast update
                if (room.isPublic) {
                    broadcastPublicRooms(io);
                }
            }
        });
    });

    // Start Selection Phase
    socket.on('start_game', ({ roomId, characters, settings }) => {
        if (!checkRateLimit(socket.id, 'game_action', 500)) return;
        const room = rooms.get(roomId);
        if (room && room.players[0]?.id === socket.id && room.gameState === 'LOBBY') {
            const connectedPlayers = room.players.filter(p => p.connected);
            if (connectedPlayers.length < 2) {
                return socket.emit('error', 'Wait for an opponent to join before starting the match.');
            }
            room.characters = characters;
            room.settings = settings || { timerLimit: null };
            room.gameState = 'SELECTING';
            resetInactivityTimer(io, roomId);
            emitRoomState(io, room, 'game_started');
            if (room.isPublic) broadcastPublicRooms(io);
        }
    });

    // Select Character
    socket.on('select_character', ({ roomId, character }) => {
        if (!checkRateLimit(socket.id, 'game_action', 500)) return;
        const room = rooms.get(roomId);
        if (room && room.gameState === 'SELECTING') {
            const player = room.players.find(p => p.id === socket.id);
            if (player && !player.isReady) {
                player.selectedCharacter = character;
                player.isReady = true;
                resetInactivityTimer(io, roomId);

                // If both players selected, start playing
                if (room.players.length === 2 && room.players.every(p => p.isReady)) {
                    room.gameState = 'PLAYING';

                    // Alternate starting player
                    if (room.lastFirstPlayerIndex === undefined) {
                        room.turn = 0;
                    } else {
                        room.turn = (room.lastFirstPlayerIndex + 1) % 2;
                    }
                    room.lastFirstPlayerIndex = room.turn;

                    // Set starting items for each player
                    room.players.forEach(p => {
                        p.guessesLeft = (room.settings.guessLimit !== undefined && room.settings.guessLimit !== null)
                            ? room.settings.guessLimit
                            : null;
                        p.eliminatedIds = [];
                        p.eliminatedCount = 0;
                    });

                    room.turnStartTime = Date.now();
                    emitRoomState(io, room, 'start_playing');
                    startRoomTimer(io, roomId);
                } else {
                    emitRoomState(io, room, 'room_updated');
                }
            }
        }
    });

    // Chat Message
    socket.on('send_message', ({ roomId, message }) => {
        if (!checkRateLimit(socket.id, 'chat', 1000)) return;
        const room = rooms.get(roomId);
        if (room) {
            let msgData;
            // Check if it's a system divider message
            if (typeof message === 'object' && message.type === 'DIVIDER') {
                msgData = {
                    ...message,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };
            } else {
                const safeMessage = sanitizeInput(message, 250);
                if (!safeMessage) return; // Ignore empty/fully-stripped messages

                msgData = {
                    sender: socket.id,
                    text: filterProfanity(safeMessage),
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };
            }
            resetInactivityTimer(io, roomId);
            room.chat.push(msgData);
            io.to(roomId).emit('receive_message', msgData);
        }
    });

    // Report User
    socket.on('report_user', ({ roomId, message, reporterName }) => {
        if (!checkRateLimit(socket.id, 'report_user', 5000)) return;
        const room = rooms.get(roomId);
        if (room) {
            const reportedPlayer = room.players.find(p => p.id === message.sender);
            console.log(`🚩 REPORT RECEIVED in Room ${roomId}:`);
            console.log(`- Reported User: ${reportedPlayer?.name} (${message.sender})`);
            console.log(`- Reporter: ${reporterName}`);
            console.log(`- Content: "${message.text}"`);

            // Log to Supabase if you have a reports table
            supabase.from('reports').insert([{
                room_id: roomId,
                reporter_name: reporterName,
                reported_user_id: reportedPlayer?.userId || null,
                reported_name: reportedPlayer?.name,
                content: message.text,
                created_at: new Date()
            }]).then(({ error }) => {
                if (error) console.error('❌ Error logging report to Supabase:', error);
                else console.log('✅ Report successfully logged to database.');
            });
        }
    });

    // Typing Status
    socket.on('typing', ({ roomId }) => {
        if (!checkRateLimit(socket.id, 'typing', 200)) return;
        resetInactivityTimer(io, roomId);
        socket.to(roomId).emit('opponent_typing');
    });

    socket.on('stop_typing', ({ roomId }) => {
        socket.to(roomId).emit('opponent_stop_typing');
    });

    // Make Guess
    socket.on('make_guess', ({ roomId, character }) => {
        if (!checkRateLimit(socket.id, 'guess', 1000)) return;
        const room = rooms.get(roomId);
        if (room && room.gameState === 'PLAYING') {
            // Server-side turn authorization (NFR-SEC-04)
            const activePlayer = room.players[room.turn];
            if (!activePlayer || activePlayer.id !== socket.id) return;

            const opponent = room.players.find(p => p.id !== socket.id);
            if (!opponent || !opponent.selectedCharacter) return;
            resetInactivityTimer(io, roomId);
            const isCorrect = character.name === opponent.selectedCharacter.name;

            if (isCorrect) {
                room.gameState = 'GAME_OVER';
                room.result = {
                    winnerId: socket.id,
                    correctCharacter: opponent.selectedCharacter
                };

                emitRoomState(io, room, 'game_over');
                clearRoomTimer(roomId);

                // Record Win/Loss in Supabase if players are logged in
                const winner = room.players.find(p => p.id === socket.id);
                const loser = opponent;

                // Only record Win/Loss if BOTH players are registered users
                // This prevents stat-padding against guests
                if (winner.userId && loser.userId) {
                    console.log(`🏆 Recording win for ${winner.name} (${winner.userId}) and loss for ${loser.name} (${loser.userId})`);

                    supabase.rpc('increment_wins', { user_id: winner.userId })
                        .then(({ error }) => {
                            if (error) console.error('❌ Error incrementing wins:', error);
                            else {
                                console.log('✅ Successfully incremented wins');
                                io.to(winner.id).emit('stats_updated');
                            }
                        });

                    supabase.rpc('increment_losses', { user_id: loser.userId })
                        .then(({ error }) => {
                            if (error) console.error('❌ Error incrementing losses:', error);
                            else {
                                console.log('✅ Successfully incremented losses');
                                io.to(loser.id).emit('stats_updated');
                            }
                        });
                } else {
                    console.log('ℹ️ Skipping win/loss recording: one or both players are guests.');
                }

            } else {
                // Wrong guess - notify guesser specifically to eliminate, and switch turn
                const guesser = room.players.find(p => p.id === socket.id);

                // Decrement guesses if limit is set
                if (room.settings.guessLimit !== null) {
                    guesser.guessesLeft -= 1;

                    // Check if player has run out of guesses
                    if (guesser.guessesLeft <= 0) {
                        room.gameState = 'GAME_OVER';
                        room.result = {
                            winnerId: opponent.id,
                            correctCharacter: opponent.selectedCharacter,
                            message: `${guesser.name} ran out of guesses!`
                        };
                        emitRoomState(io, room, 'game_over');
                        clearRoomTimer(roomId);

                        // Record Win/Loss (Opponent wins by default)
                        if (guesser.userId && opponent.userId) {
                            supabase.rpc('increment_wins', { user_id: opponent.userId })
                                .then(({ error }) => {
                                    if (!error) io.to(opponent.id).emit('stats_updated');
                                });
                            supabase.rpc('increment_losses', { user_id: guesser.userId })
                                .then(({ error }) => {
                                    if (!error) io.to(guesser.id).emit('stats_updated');
                                });
                        }

                        return; // Stop here, game is over
                    }
                }

                // Auto-record wrong guess in player's server-side eliminatedIds (NFR-REL-02)
                if (!Array.isArray(guesser.eliminatedIds)) {
                    guesser.eliminatedIds = [];
                }
                if (character.id !== undefined && !guesser.eliminatedIds.includes(character.id)) {
                    guesser.eliminatedIds.push(character.id);
                    guesser.eliminatedCount = guesser.eliminatedIds.length;
                }

                socket.emit('guess_result', { isCorrect: false, characterId: character.id });

                // Add chat notification for everyone
                const msgData = {
                    type: 'DIVIDER',
                    text: `${guesser?.name} has guessed ${character.name}`,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };
                room.chat.push(msgData);
                io.to(roomId).emit('receive_message', msgData);

                room.turn = (room.turn + 1) % room.players.length;
                room.turnStartTime = Date.now();
                emitRoomState(io, room, 'room_updated');
                startRoomTimer(io, roomId);
            }
            console.log(`Guess made in room ${roomId}. Correct: ${isCorrect}`);
        }
    });

    // Restart Game
    socket.on('restart_game', ({ roomId }) => {
        if (!checkRateLimit(socket.id, 'game_action', 500)) return;
        const room = rooms.get(roomId);
        if (room && room.players.some(p => p.id === socket.id)) {
            clearRoomTimer(roomId);
            resetInactivityTimer(io, roomId);
            room.gameState = 'LOBBY'; // Allow re-selecting mode/timer
            room.characters = [];
            room.settings = { timerLimit: null };
            room.players.forEach(p => {
                p.selectedCharacter = null;
                p.eliminatedIds = [];
                p.eliminatedCount = 0;
                p.isReady = false;
            });
            room.result = null;
            room.turn = 0;

            // Add chat divider
            room.chat.push({
                type: 'DIVIDER',
                text: 'New Round Started',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });

            emitRoomState(io, room, 'room_updated');
            console.log(`Room ${roomId} restarted`);
            if (room.isPublic) broadcastPublicRooms(io);
        }
    });

    // End Turn
    socket.on('end_turn', ({ roomId }) => {
        if (!checkRateLimit(socket.id, 'game_action', 500)) return;
        const room = rooms.get(roomId);
        if (room && room.gameState === 'PLAYING') {
            // Server-side turn authorization (NFR-SEC-04)
            const activePlayer = room.players[room.turn];
            if (!activePlayer || activePlayer.id !== socket.id) return;

            resetInactivityTimer(io, roomId);
            room.turn = (room.turn + 1) % room.players.length;
            room.turnStartTime = Date.now();
            emitRoomState(io, room, 'room_updated');
            startRoomTimer(io, roomId);
            console.log(`Turn ended in room ${roomId}. New turn: ${room.turn}`);
        }
    });

    // Update Eliminated Cards & Count (NFR-REL-02)
    socket.on('update_eliminated_count', ({ roomId, count, eliminatedIds }) => {
        if (!checkRateLimit(socket.id, 'update_eliminated_count', 200)) return;
        const room = rooms.get(roomId);
        if (room) {
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                resetInactivityTimer(io, roomId);
                if (Array.isArray(eliminatedIds)) {
                    player.eliminatedIds = eliminatedIds.slice(0, 30);
                    player.eliminatedCount = player.eliminatedIds.length;
                } else if (typeof count === 'number') {
                    player.eliminatedCount = count;
                }
                emitRoomState(io, room, 'room_updated');
            }
        }
    });

    // Lightweight Room Activity Ping (e.g. clicking/highlighting character cards in lobby/selection per FR-ROOM-08)
    socket.on('room_activity', ({ roomId }) => {
        if (!checkRateLimit(socket.id, 'room_activity', 500)) return;
        const room = rooms.get(roomId);
        if (room && room.players.some(p => p.id === socket.id)) {
            resetInactivityTimer(io, roomId);
        }
    });
}

module.exports = { handleSocketEvents };
