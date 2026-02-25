import React, { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const GameContext = createContext();

export const useGame = () => useContext(GameContext);

const SOCKET_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.PROD ? window.location.origin : 'http://localhost:3001');

export const GameProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [room, setRoom] = useState(null);
    const [playerName, setPlayerName] = useState('');
    const [error, setError] = useState('');
    const [opponentTyping, setOpponentTyping] = useState(false);
    const audioContextRef = React.useRef(null);

    // Audio for turn changes (Programmatic Ding)
    const playPing = React.useCallback(() => {
        try {
            if (!audioContextRef.current) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) return;
                audioContextRef.current = new AudioContext();
            }

            const context = audioContextRef.current;
            if (context.state === 'suspended') {
                context.resume();
            }

            const oscillator = context.createOscillator();
            const gainNode = context.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(context.destination);

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, context.currentTime); // A5 note

            gainNode.gain.setValueAtTime(0, context.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.5, context.currentTime + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.4);

            oscillator.start();
            oscillator.stop(context.currentTime + 0.4);
            console.log("🔊 Turn notification played");
        } catch (err) {
            console.error("Audio playback error:", err);
        }
    }, []);

    const sendMessage = React.useCallback((message) => {
        if (room && socket) {
            socket.emit('send_message', { roomId: room.id, message });
        }
    }, [room?.id, socket]);

    const sendTypingStatus = React.useCallback((isTyping) => {
        if (room && socket) {
            socket.emit(isTyping ? 'typing' : 'stop_typing', { roomId: room.id });
        }
    }, [room?.id, socket]);

    const makeGuess = React.useCallback((character) => {
        if (room && socket) {
            socket.emit('make_guess', { roomId: room.id, character });
        }
    }, [room?.id, socket]);

    const restartGame = React.useCallback(() => {
        if (room && socket) {
            socket.emit('restart_game', { roomId: room.id });
        }
    }, [room?.id, socket]);

    const endTurn = React.useCallback(() => {
        if (room && socket) {
            socket.emit('end_turn', { roomId: room.id });
        }
    }, [room?.id, socket]);

    const updateEliminatedCount = React.useCallback((count) => {
        if (room && socket) {
            socket.emit('update_eliminated_count', { roomId: room.id, count });
        }
    }, [room?.id, socket]);

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
            setOpponentTyping(false); // Stop typing when message received
        });

        newSocket.on('opponent_typing', () => {
            setOpponentTyping(true);
        });

        newSocket.on('opponent_stop_typing', () => {
            setOpponentTyping(false);
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

    const startGame = React.useCallback((characters, settings) => {
        if (room && socket) {
            socket.emit('start_game', { roomId: room.id, characters, settings });
        }
    }, [room?.id, socket]);

    const selectCharacter = React.useCallback((character) => {
        if (room && socket) {
            socket.emit('select_character', { roomId: room.id, character });
        }
    }, [room?.id, socket]);

    const leaveRoom = React.useCallback(() => {
        if (room && socket) {
            socket.emit('leave_room', { roomId: room.id });
            setRoom(null);
        }
    }, [room?.id, socket]);

    useEffect(() => {
        if (room?.gameState === 'PLAYING') {
            console.log("🎮 Turn changed to index:", room.turn);
            playPing();
        }
    }, [room?.turn, playPing, room?.gameState]);

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
            sendTypingStatus,
            opponentTyping,
            makeGuess,
            restartGame,
            endTurn,
            updateEliminatedCount,
            leaveRoom
        }}>
            {children}
        </GameContext.Provider>
    );
};
