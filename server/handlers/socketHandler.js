const rooms = new Map();

function handleSocketEvents(io, socket) {
    // Create Room
    socket.on('create_room', ({ playerName }) => {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const room = {
            id: roomId,
            players: [{
                id: socket.id,
                name: playerName,
                isHost: true,
                selectedCharacter: null,
                isReady: false
            }],
            gameState: 'LOBBY', // LOBBY, SELECTING, PLAYING, GAME_OVER
            characters: [],
            turn: 0,
            chat: []
        };
        rooms.set(roomId, room);
        socket.join(roomId);
        socket.emit('room_created', { roomId, room });
        console.log(`Room created: ${roomId} by ${playerName}`);
    });

    // Join Room
    socket.on('join_room', ({ roomId, playerName }) => {
        const room = rooms.get(roomId);
        if (!room) {
            return socket.emit('error', 'Room not found');
        }
        if (room.players.length >= 2) {
            return socket.emit('error', 'Room is full');
        }

        const newPlayer = {
            id: socket.id,
            name: playerName,
            isHost: false,
            selectedCharacter: null,
            isReady: false
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
                socket.leave(roomId);

                console.log(`${playerName} left room: ${roomId}. Room terminated.`);
            }
        }
    });

    // Disconnect
    socket.on('disconnect', () => {
        rooms.forEach((room, roomId) => {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                const playerName = room.players[playerIndex].name;
                io.to(roomId).emit('room_terminated', `${playerName} has disconnected.`);
                rooms.delete(roomId);
                console.log(`Room ${roomId} terminated due to ${playerName} disconnecting.`);
            }
        });
    });

    // Start Selection Phase
    socket.on('start_game', ({ roomId, characters }) => {
        const room = rooms.get(roomId);
        if (room && room.players[0].id === socket.id) {
            room.characters = characters;
            room.gameState = 'SELECTING';
            io.to(roomId).emit('game_started', room);
        }
    });

    // Select Character
    socket.on('select_character', ({ roomId, character }) => {
        const room = rooms.get(roomId);
        if (room) {
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                player.selectedCharacter = character;
                player.isReady = true;

                // If both players selected, start playing
                if (room.players.length === 2 && room.players.every(p => p.isReady)) {
                    room.gameState = 'PLAYING';
                    room.turn = 0; // Player 1 starts
                    io.to(roomId).emit('start_playing', room);
                } else {
                    io.to(roomId).emit('room_updated', room);
                }
            }
        }
    });

    // Chat Message
    socket.on('send_message', ({ roomId, message }) => {
        const room = rooms.get(roomId);
        if (room) {
            const msgData = {
                sender: socket.id,
                text: message,
                timestamp: new Date().toLocaleTimeString()
            };
            room.chat.push(msgData);
            io.to(roomId).emit('receive_message', msgData);
        }
    });

    // Make Guess
    socket.on('make_guess', ({ roomId, character }) => {
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
            } else {
                // Wrong guess - notify guesser specifically to eliminate, and switch turn
                socket.emit('guess_result', { isCorrect: false, characterId: character.id });
                room.turn = (room.turn + 1) % room.players.length;
                io.to(roomId).emit('room_updated', room);
            }
            console.log(`Guess made in room ${roomId}. Correct: ${isCorrect}`);
        }
    });

    // Restart Game
    socket.on('restart_game', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (room) {
            room.gameState = 'SELECTING'; // Go back to character selection
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
        const room = rooms.get(roomId);
        if (room && room.gameState === 'PLAYING') {
            room.turn = (room.turn + 1) % room.players.length;
            io.to(roomId).emit('room_updated', room);
            console.log(`Turn ended in room ${roomId}. New turn: ${room.turn}`);
        }
    });
}

module.exports = { handleSocketEvents };
