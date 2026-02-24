import React, { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const GameContext = createContext();

export const useGame = () => useContext(GameContext);

const SOCKET_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export const GameProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [room, setRoom] = useState(null);
    const [playerName, setPlayerName] = useState('');
    const [error, setError] = useState('');

    const sendMessage = (message) => {
        if (room) {
            socket.emit('send_message', { roomId: room.id, message });
        }
    };

    const makeGuess = (character) => {
        if (room) {
            socket.emit('make_guess', { roomId: room.id, character });
        }
    };

    const restartGame = () => {
        if (room) {
            socket.emit('restart_game', { roomId: room.id });
        }
    };

    const endTurn = () => {
        if (room) {
            socket.emit('end_turn', { roomId: room.id });
        }
    };

    useEffect(() => {
        const newSocket = io(SOCKET_URL);
        setSocket(newSocket);

        newSocket.on('room_created', ({ roomId, room }) => {
            setRoom(room);
        });

        newSocket.on('room_updated', (updatedRoom) => {
            setRoom(updatedRoom);
        });

        newSocket.on('game_started', (updatedRoom) => {
            setRoom(updatedRoom);
        });

        newSocket.on('start_playing', (updatedRoom) => {
            setRoom(updatedRoom);
        });

        newSocket.on('game_over', (updatedRoom) => {
            setRoom(updatedRoom);
        });

        newSocket.on('room_terminated', (message) => {
            setRoom(null);
            setError(message);
            setTimeout(() => setError(''), 5000);
        });

        newSocket.on('receive_message', (msgData) => {
            setRoom(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    chat: [...prev.chat, msgData]
                };
            });
        });

        newSocket.on('guess_result', ({ isCorrect, characterId }) => {
            if (!isCorrect) {
                // We should probably handle this in the component level, 
                // but we could also broadcast a local event or error.
                // For now, let's just make sure the component knows.
                window.dispatchEvent(new CustomEvent('wrong_guess', { detail: { characterId } }));
            }
        });

        newSocket.on('error', (msg) => {
            setError(msg);
            setTimeout(() => setError(''), 3000);
        });

        return () => newSocket.close();
    }, []);

    const createRoom = (name) => {
        setPlayerName(name);
        socket.emit('create_room', { playerName: name });
    };

    const joinRoom = (roomId, name) => {
        setPlayerName(name);
        socket.emit('join_room', { roomId, playerName: name });
    };

    const startGame = (characters) => {
        if (room) {
            socket.emit('start_game', { roomId: room.id, characters });
        }
    };

    const selectCharacter = (character) => {
        if (room) {
            socket.emit('select_character', { roomId: room.id, character });
        }
    };

    const leaveRoom = () => {
        if (room) {
            socket.emit('leave_room', { roomId: room.id });
            setRoom(null);
        }
    };

    return (
        <GameContext.Provider value={{
            socket,
            room,
            playerName,
            error,
            createRoom,
            joinRoom,
            startGame,
            selectCharacter,
            sendMessage,
            makeGuess,
            restartGame,
            endTurn,
            leaveRoom
        }}>
            {children}
        </GameContext.Provider>
    );
};
