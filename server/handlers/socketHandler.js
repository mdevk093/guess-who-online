const { supabase } = require('../db');
const rooms = new Map();
const roomTimers = new Map();
const roomCleanupTimers = new Map(); // For reconnection grace period
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

function clearRoomTimer(roomId) {
    if (roomTimers.has(roomId)) {
        clearTimeout(roomTimers.get(roomId));
        roomTimers.delete(roomId);
    }
}

function startRoomTimer(io, roomId) {
    clearRoomTimer(roomId);
    const room = rooms.get(roomId);
    if (!room || room.gameState !== 'PLAYING' || !room.settings?.timerLimit) return;

    const limitMs = room.settings.timerLimit * 60 * 1000;

    const timeout = setTimeout(() => {
        const currentRoom = rooms.get(roomId);
        if (!currentRoom || currentRoom.gameState !== 'PLAYING') return;

        const nextTurn = (currentRoom.turn + 1) % currentRoom.players.length;
        const nextPlayer = currentRoom.players[nextTurn];

        currentRoom.turn = nextTurn;
        currentRoom.turnStartTime = Date.now();

        const msgData = {
            type: 'DIVIDER',
            text: `Time's up! It's now ${nextPlayer.name}'s turn.`,
            timestamp: new Date().toLocaleTimeString()
        };
        currentRoom.chat.push(msgData);

        io.to(roomId).emit('room_updated', currentRoom);

        // Start timer for the next player
        startRoomTimer(io, roomId);
    }, limitMs);

    roomTimers.set(roomId, timeout);
}

function handleSocketEvents(io, socket) {
    // Create Room
    socket.on('create_room', ({ playerName, userId }) => {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const room = {
            id: roomId,
            players: [{
                id: socket.id,
                userId: userId, // Store Supabase UID
                name: playerName,
                isHost: true,
                selectedCharacter: null,
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
        socket.join(roomId);
        socket.emit('room_created', { roomId, room });
        console.log(`Room created: ${roomId} by ${playerName}`);
    });

    // Join Room
    socket.on('join_room', ({ roomId, playerName, userId }) => {
        const room = rooms.get(roomId);
        if (!room) {
            return socket.emit('error', 'Room not found');
        }

        // Check for reconnection
        const existingPlayer = room.players.find(p =>
            (userId && p.userId === userId) || (p.name === playerName && !p.connected)
        );

        if (existingPlayer) {
            console.log(`Player ${playerName} reconnected to room ${roomId}`);
            existingPlayer.id = socket.id;
            existingPlayer.connected = true;
            if (userId) existingPlayer.userId = userId; // Update userId if player is now logged in

            // Clear any cleanup timers for this room if both players are back
            if (room.players.every(p => p.connected)) {
                if (roomCleanupTimers.has(roomId)) {
                    clearTimeout(roomCleanupTimers.get(roomId));
                    roomCleanupTimers.delete(roomId);
                }
            }

            socket.join(roomId);
            io.to(roomId).emit('room_updated', room);
            return;
        }

        if (room.players.length >= 2) {
            return socket.emit('error', 'Room is full');
        }

        const newPlayer = {
            id: socket.id,
            userId: userId, // Store Supabase UID
            name: playerName,
            isHost: false,
            selectedCharacter: null,
            isReady: false,
            connected: true
        };

        room.players.push(newPlayer);
        socket.join(roomId);
        io.to(roomId).emit('room_updated', room);
        console.log(`${playerName} joined room: ${roomId}`);
    });

    // Leave Room
    socket.on('leave_room', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (room) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                const playerName = room.players[playerIndex].name;

                // Notify the other player and terminate the room
                io.to(roomId).emit('room_terminated', `${playerName} has quit the game.`);
                rooms.delete(roomId);
                clearRoomTimer(roomId);
                socket.leave(roomId);

                console.log(`${playerName} left room: ${roomId}. Room terminated.`);
            }
        }
    });

    // Disconnect
    socket.on('disconnect', () => {
        lastEventTimestamps.delete(socket.id); // Clean up rate limit data
        rooms.forEach((room, roomId) => {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                const player = room.players[playerIndex];
                player.connected = false;

                console.log(`Player ${player.name} disconnected from room ${roomId}. Waiting for reconnection...`);
                io.to(roomId).emit('room_updated', room);

                // Start grace period cleanup
                const cleanupTimeout = setTimeout(() => {
                    const currentRoom = rooms.get(roomId);
                    if (currentRoom && !player.connected) {
                        io.to(roomId).emit('room_terminated', `${player.name} failed to reconnect.`);
                        rooms.delete(roomId);
                        clearRoomTimer(roomId);
                        roomCleanupTimers.delete(roomId);
                        console.log(`Room ${roomId} terminated after grace period.`);
                    }
                }, 60000); // 60 seconds grace period

                roomCleanupTimers.set(roomId, cleanupTimeout);
            }
        });
    });

    // Start Selection Phase
    socket.on('start_game', ({ roomId, characters, settings }) => {
        if (!checkRateLimit(socket.id, 'game_action', 500)) return;
        const room = rooms.get(roomId);
        if (room && room.players[0].id === socket.id) {
            room.characters = characters;
            room.settings = settings || { timerLimit: null };
            room.gameState = 'SELECTING';
            io.to(roomId).emit('game_started', room);
        }
    });

    // Select Character
    socket.on('select_character', ({ roomId, character }) => {
        if (!checkRateLimit(socket.id, 'game_action', 500)) return;
        const room = rooms.get(roomId);
        if (room) {
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                player.selectedCharacter = character;
                player.isReady = true;

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
                    });

                    room.turnStartTime = Date.now();
                    io.to(roomId).emit('start_playing', room);
                    startRoomTimer(io, roomId);
                } else {
                    io.to(roomId).emit('room_updated', room);
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
                    timestamp: new Date().toLocaleTimeString()
                };
            } else {
                msgData = {
                    sender: socket.id,
                    text: filterProfanity(message),
                    timestamp: new Date().toLocaleTimeString()
                };
            }
            room.chat.push(msgData);
            io.to(roomId).emit('receive_message', msgData);
        }
    });

    // Report User
    socket.on('report_user', ({ roomId, message, reporterName }) => {
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
            const opponent = room.players.find(p => p.id !== socket.id);
            const isCorrect = character.name === opponent.selectedCharacter.name;

            if (isCorrect) {
                room.gameState = 'GAME_OVER';
                room.result = {
                    winnerId: socket.id,
                    correctCharacter: opponent.selectedCharacter
                };

                io.to(roomId).emit('game_over', room);
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
                        io.to(roomId).emit('game_over', room);
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

                socket.emit('guess_result', { isCorrect: false, characterId: character.id });

                // Add chat notification for everyone
                const msgData = {
                    type: 'DIVIDER',
                    text: `${guesser?.name} has guessed ${character.name}`,
                    timestamp: new Date().toLocaleTimeString()
                };
                room.chat.push(msgData);
                io.to(roomId).emit('receive_message', msgData);

                room.turn = (room.turn + 1) % room.players.length;
                room.turnStartTime = Date.now();
                io.to(roomId).emit('room_updated', room);
                startRoomTimer(io, roomId);
            }
            console.log(`Guess made in room ${roomId}. Correct: ${isCorrect}`);
        }
    });

    // Restart Game
    socket.on('restart_game', ({ roomId }) => {
        if (!checkRateLimit(socket.id, 'game_action', 500)) return;
        const room = rooms.get(roomId);
        if (room) {
            clearRoomTimer(roomId);
            room.gameState = 'LOBBY'; // Allow re-selecting mode/timer
            room.characters = [];
            room.settings = { timerLimit: null };
            room.players.forEach(p => {
                p.selectedCharacter = null;
                p.isReady = false;
            });
            room.result = null;
            room.turn = 0;

            // Add chat divider
            room.chat.push({
                type: 'DIVIDER',
                text: 'New Round Started',
                timestamp: new Date().toLocaleTimeString()
            });

            io.to(roomId).emit('room_updated', room);
            console.log(`Room ${roomId} restarted`);
        }
    });

    // End Turn
    socket.on('end_turn', ({ roomId }) => {
        if (!checkRateLimit(socket.id, 'game_action', 500)) return;
        const room = rooms.get(roomId);
        if (room && room.gameState === 'PLAYING') {
            room.turn = (room.turn + 1) % room.players.length;
            room.turnStartTime = Date.now();
            io.to(roomId).emit('room_updated', room);
            startRoomTimer(io, roomId);
            console.log(`Turn ended in room ${roomId}. New turn: ${room.turn}`);
        }
    });

    // Update Eliminated Count
    socket.on('update_eliminated_count', ({ roomId, count }) => {
        const room = rooms.get(roomId);
        if (room) {
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                player.eliminatedCount = count;
                io.to(roomId).emit('room_updated', room);
            }
        }
    });
}

module.exports = { handleSocketEvents };
