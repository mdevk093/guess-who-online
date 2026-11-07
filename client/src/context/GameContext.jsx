import React, { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { supabase } from '../supabaseClient';

const GameContext = createContext();

export const useGame = () => useContext(GameContext);

const SOCKET_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.PROD ? window.location.origin : 'http://localhost:3001');

// Helper to decode HTML entities the server sanitized, since React escapes raw strings properly anyway
export const decodeHtmlEntity = function (str) {
    if (!str) return str;
    return str.replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
};

export const GameProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [room, setRoom] = useState(null);
    const [playerName, setPlayerName] = useState(() => {
        try {
            return sessionStorage.getItem('player_name') || localStorage.getItem('player_name') || '';
        } catch {
            return '';
        }
    });
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [isGuest, setIsGuest] = useState(false);
    const [error, setError] = useState('');
    const [opponentTyping, setOpponentTyping] = useState(false);
    const [stats, setStats] = useState({ wins: 0, losses: 0 });
    const [publicRooms, setPublicRooms] = useState([]);
    const audioContextRef = React.useRef(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user?.user_metadata?.username) {
                setPlayerName(session.user.user_metadata.username);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user?.user_metadata?.username) {
                setPlayerName(session.user.user_metadata.username);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchStats = React.useCallback(async () => {
        if (!user) return;
        const { data, error } = await supabase
            .from('profiles')
            .select('wins, losses')
            .eq('id', user.id)
            .single();
        if (data && !error) {
            setStats(data);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            fetchStats();
        }
    }, [user, fetchStats]);

    // Audio helper for programmatic sounds
    const playSound = React.useCallback((freq, duration, type = 'sine', volume = 0.5) => {
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

            const osc = context.createOscillator();
            const gain = context.createGain();

            osc.connect(gain);
            gain.connect(context.destination);

            osc.type = type;
            osc.frequency.setValueAtTime(freq, context.currentTime);

            gain.gain.setValueAtTime(0, context.currentTime);
            gain.gain.linearRampToValueAtTime(volume, context.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);

            osc.start();
            osc.stop(context.currentTime + duration);
        } catch (err) {
            console.error("Audio playback error:", err);
        }
    }, []);

    const playPing = React.useCallback(() => {
        playSound(880, 0.4, 'sine', 0.5); // A5 note
        console.log("🔊 Turn notification played");
    }, [playSound]);

    const playTick = React.useCallback(() => {
        playSound(1200, 0.05, 'sine', 0.1); // Short high-pitched tick
    }, [playSound]);

    // Upbeat two-tone chime when a player joins a lobby
    const playJoinSound = React.useCallback(() => {
        playSound(523.25, 0.14, 'triangle', 0.4); // C5
        setTimeout(() => {
            playSound(783.99, 0.25, 'triangle', 0.45); // G5
        }, 110);
        console.log("🔔 Lobby join sound played");
    }, [playSound]);

    const sendMessage = React.useCallback((message) => {
        if (room && socket) {
            socket.emit('send_message', { roomId: room.id, message });
        }
    }, [room, socket]);

    const sendTypingStatus = React.useCallback((isTyping) => {
        if (room && socket) {
            socket.emit(isTyping ? 'typing' : 'stop_typing', { roomId: room.id });
        }
    }, [room, socket]);

    const makeGuess = React.useCallback((character) => {
        if (room && socket) {
            socket.emit('make_guess', { roomId: room.id, character });
        }
    }, [room, socket]);

    const restartGame = React.useCallback(() => {
        if (room && socket) {
            socket.emit('restart_game', { roomId: room.id });
        }
    }, [room, socket]);

    const endTurn = React.useCallback(() => {
        if (room && socket) {
            socket.emit('end_turn', { roomId: room.id });
        }
    }, [room, socket]);

    const updateEliminatedCount = React.useCallback((count, eliminatedIds) => {
        if (room && socket) {
            socket.emit('update_eliminated_count', { roomId: room.id, count, eliminatedIds });
        }
    }, [room, socket]);

    const reportPlayer = React.useCallback((message) => {
        if (room && socket) {
            socket.emit('report_user', { roomId: room.id, message, reporterName: playerName });
        }
    }, [room, socket, playerName]);

    const hasAttemptedRejoinRef = React.useRef(false);

    const sessionRef = React.useRef(null);

    useEffect(() => {
        sessionRef.current = session;
    }, [session]);

    const attemptAutoRejoin = React.useCallback(async (activeSocket) => {
        if (!activeSocket || !activeSocket.connected || hasAttemptedRejoinRef.current) return;
        const lastRoomId = sessionStorage.getItem('last_room_id') || localStorage.getItem('last_room_id');
        const savedName = sessionStorage.getItem('player_name') || localStorage.getItem('player_name');
        if (lastRoomId && savedName) {
            hasAttemptedRejoinRef.current = true;
            // Ensure we grab the latest Supabase session if available
            let token = sessionRef.current?.access_token || null;
            if (!token) {
                try {
                    const { data } = await supabase.auth.getSession();
                    token = data?.session?.access_token || null;
                } catch (e) {
                    // ignore
                }
            }
            console.log("🔄 Auto-rejoining room:", lastRoomId, "as", savedName);
            activeSocket.emit('join_room', {
                roomId: lastRoomId,
                playerName: savedName,
                accessToken: token
            });
        }
    }, []);

    useEffect(() => {
        const newSocket = io(SOCKET_URL);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log("🔌 Socket connected:", newSocket.id);
            // Re-allow re-joining on a fresh connection if we lost it
            hasAttemptedRejoinRef.current = false;
            attemptAutoRejoin(newSocket);
            newSocket.emit('get_public_rooms');
        });

        newSocket.on('public_rooms_update', (roomsList) => {
            setPublicRooms(Array.isArray(roomsList) ? roomsList : []);
        });

        newSocket.on('player_joined_sound', () => {
            playJoinSound();
        });

        newSocket.on('room_created', ({ roomId, room }) => {
            setRoom(room);
            sessionStorage.setItem('last_room_id', roomId);
            localStorage.setItem('last_room_id', roomId);
            window.history.replaceState({}, document.title, `${window.location.pathname}?room=${roomId}`);
        });

        newSocket.on('room_updated', (updatedRoom) => {
            setRoom(updatedRoom);
            if (updatedRoom?.id) {
                sessionStorage.setItem('last_room_id', updatedRoom.id);
                localStorage.setItem('last_room_id', updatedRoom.id);
                window.history.replaceState({}, document.title, `${window.location.pathname}?room=${updatedRoom.id}`);
                if (updatedRoom.gameState === 'LOBBY' || updatedRoom.gameState === 'SELECTING') {
                    sessionStorage.removeItem(`eliminated_ids_${updatedRoom.id}`);
                    localStorage.removeItem(`eliminated_ids_${updatedRoom.id}`);
                }
            }
        });

        newSocket.on('game_started', (updatedRoom) => {
            if (updatedRoom?.id) {
                sessionStorage.removeItem(`eliminated_ids_${updatedRoom.id}`);
                localStorage.removeItem(`eliminated_ids_${updatedRoom.id}`);
            }
            setRoom(updatedRoom);
        });

        newSocket.on('start_playing', (updatedRoom) => {
            if (updatedRoom?.id) {
                sessionStorage.removeItem(`eliminated_ids_${updatedRoom.id}`);
                localStorage.removeItem(`eliminated_ids_${updatedRoom.id}`);
            }
            setRoom(updatedRoom);
        });

        newSocket.on('game_over', (updatedRoom) => {
            setRoom(updatedRoom);
        });

        newSocket.on('room_terminated', (message) => {
            const lastRoomId = sessionStorage.getItem('last_room_id') || localStorage.getItem('last_room_id');
            if (lastRoomId) {
                sessionStorage.removeItem(`eliminated_ids_${lastRoomId}`);
                localStorage.removeItem(`eliminated_ids_${lastRoomId}`);
            }
            setRoom(null);
            setError(message);
            sessionStorage.removeItem('last_room_id');
            localStorage.removeItem('last_room_id');
            window.history.replaceState({}, document.title, window.location.pathname);
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
                window.dispatchEvent(new CustomEvent('wrong_guess', { detail: { characterId } }));
            }
        });

        newSocket.on('error', (msg) => {
            setError(msg);
            setTimeout(() => setError(''), 3000);
        });

        newSocket.on('stats_updated', () => {
            console.log("📊 Stats updated, re-fetching...");
            fetchStats();
        });

        return () => newSocket.close();
    }, []);

    const createRoom = (name, isPublic = false) => {
        setPlayerName(name);
        sessionStorage.setItem('player_name', name);
        localStorage.setItem('player_name', name);
        socket.emit('create_room', {
            playerName: name,
            accessToken: session?.access_token || null,
            isPublic: Boolean(isPublic)
        });
    };

    const toggleRoomPublic = React.useCallback((isPublic) => {
        if (room && socket) {
            socket.emit('toggle_room_public', { roomId: room.id, isPublic: Boolean(isPublic) });
        }
    }, [room, socket]);

    const fetchPublicRooms = React.useCallback(() => {
        if (socket) {
            socket.emit('get_public_rooms');
        }
    }, [socket]);

    const joinRoom = (roomId, name) => {
        setPlayerName(name);
        sessionStorage.setItem('player_name', name);
        localStorage.setItem('player_name', name);
        socket.emit('join_room', { roomId, playerName: name, accessToken: session?.access_token || null });
    };

    const startGame = React.useCallback((characters, settings) => {
        if (room && socket) {
            socket.emit('start_game', { roomId: room.id, characters, settings });
        }
    }, [room, socket]);

    const selectCharacter = React.useCallback((character) => {
        if (room && socket) {
            socket.emit('select_character', { roomId: room.id, character });
        }
    }, [room, socket]);

    const leaveRoom = React.useCallback(() => {
        if (room && socket) {
            sessionStorage.removeItem(`eliminated_ids_${room.id}`);
            localStorage.removeItem(`eliminated_ids_${room.id}`);
            sessionStorage.removeItem('last_room_id');
            localStorage.removeItem('last_room_id');
            window.history.replaceState({}, document.title, window.location.pathname);
            socket.emit('leave_room', { roomId: room.id });
            setRoom(null);
        }
    }, [room, socket]);

    const kickPlayer = React.useCallback((targetPlayerId) => {
        if (room && socket && targetPlayerId) {
            socket.emit('kick_player', { roomId: room.id, targetPlayerId });
        }
    }, [room, socket]);

    const pingRoomActivity = React.useCallback(() => {
        if (room && socket) {
            socket.emit('room_activity', { roomId: room.id });
        }
    }, [room, socket]);

    useEffect(() => {
        if (room?.gameState === 'PLAYING') {
            console.log("🎮 Turn changed to index:", room.turn);
            playPing();
        }
    }, [room?.turn, playPing, room?.gameState]);

    const continueAsGuest = () => {
        setIsGuest(true);
    };

    return (
        <GameContext.Provider value={{
            socket,
            room,
            playerName,
            setPlayerName,
            error,
            createRoom,
            joinRoom,
            publicRooms,
            fetchPublicRooms,
            toggleRoomPublic,
            playJoinSound,
            startGame,
            selectCharacter,
            sendMessage,
            sendTypingStatus,
            opponentTyping,
            makeGuess,
            restartGame,
            endTurn,
            playTick,
            updateEliminatedCount,
            reportPlayer,
            leaveRoom,
            kickPlayer,
            pingRoomActivity,
            user,
            session,
            isGuest,
            continueAsGuest,
            stats,
            fetchStats
        }}>
            {children}
        </GameContext.Provider>
    );
};
