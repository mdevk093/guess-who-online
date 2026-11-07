import React, { useState } from 'react';
import { useGame, decodeHtmlEntity } from '../context/GameContext';
import Chat from './Chat';

const getInitials = (name) => {
    if (!name) return 'OP';
    const clean = decodeHtmlEntity(name).trim();
    return clean.slice(0, 2).toUpperCase();
};

const GameBoard = () => {
    const { room, socket, makeGuess, restartGame, endTurn, updateEliminatedCount, leaveRoom, opponentTyping, user, stats } = useGame();
    const me = room.players.find(p => p.id === socket.id);
    const myTurn = room.players[room.turn].id === socket.id;
    const opponent = room.players.find(p => p.id !== socket.id);

    // Initialize eliminatedIds from server player state or storage (NFR-REL-02)
    const [eliminatedIds, setEliminatedIds] = useState(() => {
        if (Array.isArray(me?.eliminatedIds) && me.eliminatedIds.length > 0) {
            return me.eliminatedIds;
        }
        try {
            const saved = sessionStorage.getItem(`eliminated_ids_${room.id}`) || localStorage.getItem(`eliminated_ids_${room.id}`);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch (err) {
            console.error('Failed to parse saved eliminatedIds:', err);
        }
        return [];
    });
    const [guessModalOpen, setGuessModalOpen] = useState(false);
    const [mobileTab, setMobileTab] = useState('board'); // 'board' or 'chat'
    const [unreadMessages, setUnreadMessages] = useState(false);
    const [timeLeft, setTimeLeft] = useState(null);
    const [showMyCharacterModal, setShowMyCharacterModal] = useState(false);
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const [disconnectTimeLeft, setDisconnectTimeLeft] = useState(20);

    // Track unread messages on mobile
    React.useEffect(() => {
        if (room?.chat?.length > 0) {
            const lastMsg = room.chat[room.chat.length - 1];
            if (lastMsg.sender !== socket.id && mobileTab !== 'chat') {
                setUnreadMessages(true);
            }
        }
    }, [room?.chat, mobileTab, socket.id]);

    // Clear unread messages when opening chat tab
    React.useEffect(() => {
        if (mobileTab === 'chat') {
            setUnreadMessages(false);
        }
    }, [mobileTab]);

    const toggleEliminate = (id) => {
        if (eliminatedIds.includes(id)) {
            setEliminatedIds(eliminatedIds.filter(i => i !== id));
        } else {
            setEliminatedIds([...eliminatedIds, id]);
        }
    };

    const handleGuess = (char) => {
        makeGuess(char);
        setGuessModalOpen(false);
    };

    // Auto-eliminate on wrong guess from server event
    React.useEffect(() => {
        const handleWrongGuess = (e) => {
            const { characterId } = e.detail;
            if (!eliminatedIds.includes(characterId)) {
                setEliminatedIds(prev => [...prev, characterId]);
            }
        };
        window.addEventListener('wrong_guess', handleWrongGuess);
        return () => window.removeEventListener('wrong_guess', handleWrongGuess);
    }, [eliminatedIds]);

    // Sync eliminatedIds to storage and server (NFR-REL-02)
    React.useEffect(() => {
        if (room?.id) {
            try {
                const serialized = JSON.stringify(eliminatedIds);
                sessionStorage.setItem(`eliminated_ids_${room.id}`, serialized);
                localStorage.setItem(`eliminated_ids_${room.id}`, serialized);
            } catch (err) {
                console.error('Failed to save eliminatedIds:', err);
            }
        }
        updateEliminatedCount(eliminatedIds.length, eliminatedIds);
    }, [eliminatedIds, room?.id]);

    // Determine result from room state
    const isGameOver = room.gameState === 'GAME_OVER';
    const won = isGameOver && room.result.winnerId === socket.id;
    const correctCharacter = isGameOver ? room.result.correctCharacter : null;

    // Timer Logic (pauses while opponent is disconnected per NFR-REL-04)
    React.useEffect(() => {
        if (!room.settings?.timerLimit || isGameOver || room.gameState !== 'PLAYING') {
            setTimeLeft(null);
            return;
        }

        const timerLimitMs = room.settings.timerLimit * 60 * 1000;

        if (opponent && !opponent.connected) {
            if (room.turnRemainingMs !== undefined && room.turnRemainingMs !== null) {
                setTimeLeft(Math.ceil(room.turnRemainingMs / 1000));
            }
            return;
        }

        const updateTimer = () => {
            const elapsed = Date.now() - room.turnStartTime;
            const remaining = Math.max(0, timerLimitMs - elapsed);
            setTimeLeft(Math.ceil(remaining / 1000));
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [room.turnStartTime, room.turnRemainingMs, room.settings?.timerLimit, isGameOver, room.gameState, opponent?.connected]);

    // 20-Second Disconnect Countdown UI (NFR-REL-04)
    React.useEffect(() => {
        if (!opponent || opponent.connected || isGameOver) {
            setDisconnectTimeLeft(20);
            return;
        }

        const startTimestamp = opponent.disconnectedAt || Date.now();
        const updateDisconnectCountdown = () => {
            const elapsedSec = Math.floor((Date.now() - startTimestamp) / 1000);
            setDisconnectTimeLeft(Math.max(0, 20 - elapsedSec));
        };

        updateDisconnectCountdown();
        const interval = setInterval(updateDisconnectCountdown, 250);
        return () => clearInterval(interval);
    }, [opponent?.connected, opponent?.disconnectedAt, isGameOver]);

    const formatTime = (seconds) => {
        if (seconds === null) return null;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const totalSuspects = room?.characters?.length || 0;
    const mySuspectsLeft = totalSuspects - eliminatedIds.length;
    const oppSuspectsLeft = totalSuspects - (opponent?.eliminatedCount || 0);
    const opponentName = opponent?.name ? decodeHtmlEntity(opponent.name) : 'Opponent';

    return (
        <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-[#f8fafc] text-slate-800 p-3 sm:p-6 flex flex-col">
            <div className="max-w-7xl w-full mx-auto flex-1 min-h-0 flex flex-col gap-4 sm:gap-5">

                {/* Top Game Header Card */}
                <div className="rounded-3xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 border bg-white border-slate-200 shadow-sm shrink-0 relative z-30">
                    <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                        {/* Brand Logo */}
                        <div className="flex items-center gap-2.5 pr-1 sm:pr-2">
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-600 shadow-md shadow-sky-500/25 flex items-center justify-center font-black text-white text-lg shrink-0">
                                ?
                            </div>
                            <span className="text-lg font-black text-slate-900 tracking-tight hidden xl:block">Guess Who?</span>
                        </div>

                        {/* Opponent Pill */}
                        <div className="flex items-center gap-2.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl border bg-slate-50 border-slate-200">
                            <div className="relative">
                                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center font-black text-xs bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                                    {getInitials(opponent?.name)}
                                </div>
                                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 border-2 rounded-full border-white ${opponent?.connected !== false ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                            </div>
                            <div>
                                <div className="text-xs font-bold text-slate-900 max-w-[110px] sm:max-w-[150px] truncate">{opponentName}</div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                                    <span>{oppSuspectsLeft} suspects left</span>
                                </div>
                            </div>
                        </div>

                        {/* Active Turn Pill */}
                        <div className={`flex items-center gap-2.5 px-4 sm:px-5 py-2 rounded-2xl border transition-all ${myTurn
                            ? 'bg-sky-50 border-sky-300'
                            : 'bg-slate-50 border-slate-200'
                            }`}>
                            <span className={`w-2.5 h-2.5 rounded-full ${myTurn ? 'bg-sky-500 animate-ping' : 'bg-slate-400'}`}></span>
                            <div className="flex flex-col">
                                <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${myTurn ? 'text-sky-700' : 'text-slate-400'}`}>
                                    {myTurn ? 'Active Turn' : 'Waiting'}
                                </span>
                                <span className="text-xs font-black text-slate-900">
                                    {myTurn ? 'YOUR TURN TO ASK' : `${opponentName.split(' ')[0].toUpperCase()}'S TURN`}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Timer, Guesses & Actions */}
                    <div className="flex items-center gap-2 sm:gap-2.5 ml-auto">
                        {timeLeft !== null && (
                            <div className="px-3.5 py-2 rounded-2xl border bg-slate-50 border-slate-200 flex items-center gap-2">
                                <span className="text-[10px] sm:text-xs font-bold uppercase text-slate-500">Timer</span>
                                <span className={`text-sm sm:text-base font-black tabular-nums ${timeLeft < 10 && myTurn ? 'text-rose-600 animate-pulse' : 'text-slate-900'}`}>
                                    {formatTime(timeLeft)}
                                </span>
                            </div>
                        )}

                        {room.settings?.guessLimit !== null && room.settings?.guessLimit !== undefined && (
                            <div className="hidden md:flex px-3.5 py-2 rounded-2xl border bg-slate-50 border-slate-200 items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${(me?.guessesLeft || 0) <= 1 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                                <span className="text-xs font-black text-slate-800 tabular-nums">{me?.guessesLeft ?? 0} Guesses</span>
                            </div>
                        )}

                        <button
                            onClick={() => setGuessModalOpen(true)}
                            disabled={!myTurn || isGameOver}
                            className="hidden sm:flex font-black text-xs px-4 sm:px-5 py-2.5 rounded-xl shadow-lg transition-all items-center gap-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white shadow-sky-600/25 active:scale-95"
                        >
                            <span>🎯</span> Guess Opponent
                        </button>

                        <button
                            onClick={endTurn}
                            disabled={!myTurn || isGameOver}
                            className="hidden sm:inline-flex font-black text-xs px-4 py-2.5 rounded-xl border transition-all bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 border-slate-200 active:scale-95"
                        >
                            End Turn
                        </button>

                        <button
                            onClick={() => setShowLeaveConfirm(true)}
                            className="p-2.5 bg-rose-50 hover:bg-rose-600 border border-rose-200 text-rose-600 hover:text-white rounded-xl transition-all shadow-sm active:scale-95"
                            title="Quit Game"
                        >
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                        </button>
                    </div>
                </div>

                {/* Main Columns: Suspects Board (8 cols) & Chat HUD (4 cols) */}
                <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch relative pb-20 sm:pb-0">

                    {/* Left: Suspects Board (8 cols) */}
                    <div className="lg:col-span-8 rounded-3xl p-4 sm:p-5 bg-white border border-slate-200 shadow-sm flex flex-col min-h-0">
                        <div className="flex items-center justify-between mb-3.5 shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Suspects Board</span>
                                <span className="text-xs font-bold px-2.5 py-0.5 rounded-md border bg-slate-100 border-slate-200 text-sky-700">
                                    {mySuspectsLeft} / {totalSuspects} Active
                                </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-slate-600">
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Active</span>
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-400"></span> Eliminated</span>
                            </div>
                        </div>

                        {/* Suspect Cards Grid */}
                        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5 sm:gap-3">
                                {(room.characters && room.characters.length > 0 ? room.characters : []).map((char) => {
                                    const isEliminated = eliminatedIds.includes(char.id);
                                    const isMySecret = me?.selectedCharacter?.id === char.id;

                                    if (isEliminated) {
                                        return (
                                            <div
                                                key={char.id}
                                                onClick={() => toggleEliminate(char.id)}
                                                className="group relative rounded-2xl p-1.5 sm:p-2 text-center opacity-40 grayscale hover:opacity-65 transition-all cursor-pointer border border-slate-200 bg-slate-50"
                                            >
                                                <div className="aspect-[4/5] rounded-xl overflow-hidden mb-1.5 relative flex items-center justify-center bg-slate-900/20">
                                                    <img
                                                        src={char.image}
                                                        alt={char.name}
                                                        className="w-full h-full object-cover opacity-50"
                                                    />
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <span className="text-rose-600 font-black text-2xl drop-shadow">✕</span>
                                                    </div>
                                                </div>
                                                <div className="text-[11px] sm:text-xs font-bold line-through truncate text-slate-600">
                                                    {char.name}
                                                </div>
                                                <div className="text-[9px] sm:text-[10px] text-slate-400">Eliminated</div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div
                                            key={char.id}
                                            onClick={() => toggleEliminate(char.id)}
                                            className={`group relative rounded-2xl p-1.5 sm:p-2 text-center transition-all cursor-pointer transform hover:-translate-y-1 ${isMySecret
                                                ? 'bg-white border-2 border-sky-500 shadow-md shadow-sky-100 ring-2 ring-sky-100'
                                                : 'bg-white border border-slate-200 hover:border-sky-400 shadow-sm'
                                                }`}
                                        >
                                            <div className="aspect-[4/5] rounded-xl overflow-hidden mb-1.5 relative bg-slate-50">
                                                <img
                                                    src={char.image}
                                                    alt={char.name}
                                                    className="w-full h-full object-cover"
                                                />
                                                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400 shadow"></span>
                                            </div>
                                            <div className="text-[11px] sm:text-xs font-black truncate text-slate-900">
                                                {char.name}
                                            </div>
                                            <div className="text-[9px] sm:text-[10px] text-slate-500 truncate">
                                                {isMySecret ? '★ Your Card' : 'Active'}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Secret Card Bottom Tray */}
                        <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl border-2 bg-sky-50 border-sky-400 overflow-hidden shadow-sm p-0.5 shrink-0">
                                    <img
                                        src={me?.selectedCharacter?.image}
                                        alt={me?.selectedCharacter?.name || 'Secret Character'}
                                        className="w-full h-full object-cover rounded-lg"
                                    />
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest block text-sky-600">
                                        Your Secret Character
                                    </span>
                                    <span className="text-sm font-black text-slate-900">
                                        {me?.selectedCharacter?.name} <span className="text-xs font-bold text-slate-400">(Keep Hidden!)</span>
                                    </span>
                                </div>
                            </div>
                            <div className="text-xs text-slate-400 italic hidden sm:block">
                                Opponent sees this as a hidden card
                            </div>
                        </div>
                    </div>

                    {/* Right: Deduction Chat HUD (4 cols on desktop, sliding drawer on mobile) */}
                    <div className={`
                        lg:col-span-4 flex flex-col min-h-0
                        sm:relative sm:bottom-auto sm:left-auto sm:right-auto sm:h-[420px] lg:h-full sm:translate-y-0 sm:z-auto
                        fixed bottom-[76px] left-3 right-3 z-40 h-[58vh] transition-transform duration-300 ease-out
                        ${mobileTab === 'board' ? 'translate-y-[150%] sm:translate-y-0' : 'translate-y-0'}
                    `}>
                        <Chat isOpen={mobileTab === 'chat'} />
                    </div>

                    {/* Reconnection Overlay (NFR-REL-04) */}
                    {opponent && !opponent.connected && !isGameOver && (
                        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[80] flex items-center justify-center p-6 animate-in fade-in duration-300">
                            <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-slate-200 transform animate-in zoom-in duration-300">
                                <div className="w-16 h-16 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center mx-auto mb-6 relative">
                                    <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                                <h3 className="text-xl font-black text-slate-900 mb-2">Opponent Disconnected</h3>
                                <p className="text-slate-500 text-sm font-medium leading-relaxed mb-5">
                                    Waiting for <span className="text-sky-600 font-bold">{opponentName}</span> to rejoin...
                                </p>
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                                    <div className="flex items-center justify-between text-xs font-black uppercase tracking-widest mb-2">
                                        <span className="text-slate-400">Auto-closing in</span>
                                        <span className={`text-base tabular-nums ${disconnectTimeLeft <= 5 ? 'text-rose-500 animate-pulse' : 'text-amber-600'}`}>
                                            {disconnectTimeLeft}s
                                        </span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-300 rounded-full ${disconnectTimeLeft <= 5 ? 'bg-rose-500' : 'bg-amber-500'}`}
                                            style={{ width: `${(disconnectTimeLeft / 20) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Mobile Navigation Bar (Persistent Actions) */}
                    <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 flex items-center justify-between gap-2.5 z-50 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.08)]">
                        <button
                            onClick={() => setShowMyCharacterModal(true)}
                            className="w-11 h-11 rounded-xl overflow-hidden border-2 border-sky-400 bg-sky-50 shadow-sm shrink-0 active:scale-95 transition-all"
                        >
                            <img src={me?.selectedCharacter?.image} alt="You" className="w-full h-full object-cover" />
                        </button>

                        <div className="flex-1 flex gap-2">
                            <button
                                onClick={() => setGuessModalOpen(true)}
                                disabled={!myTurn || isGameOver}
                                className="flex-1 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 py-2.5 rounded-xl font-black text-xs text-white shadow-md shadow-sky-600/20 transition-all active:scale-95 flex items-center justify-center gap-1"
                            >
                                <span>🎯</span> Guess
                            </button>
                            <button
                                onClick={endTurn}
                                disabled={!myTurn || isGameOver}
                                className="flex-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 disabled:opacity-40 py-2.5 rounded-xl font-black text-xs text-slate-700 transition-all active:scale-95"
                            >
                                End Turn
                            </button>
                        </div>

                        <button
                            onClick={() => setMobileTab(mobileTab === 'board' ? 'chat' : 'board')}
                            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all shrink-0 border ${mobileTab === 'chat'
                                ? 'bg-sky-50 text-sky-600 border-sky-200'
                                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                }`}
                        >
                            <div className="relative">
                                {mobileTab === 'board' ? (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                                )}
                                {(unreadMessages || (opponentTyping && mobileTab !== 'chat')) && (
                                    <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white animate-pulse ${opponentTyping ? 'bg-sky-500' : 'bg-rose-500'}`} />
                                )}
                            </div>
                        </button>
                    </div>
                </div>
            </div>

            {/* My Character Modal (Mobile) */}
            {showMyCharacterModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[150] p-6 lg:hidden animate-in fade-in" onClick={() => setShowMyCharacterModal(false)}>
                    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 flex flex-col items-center animate-in zoom-in duration-200 w-full max-w-xs" onClick={e => e.stopPropagation()}>
                        <div className="w-40 h-40 rounded-3xl overflow-hidden shadow-lg mb-4 border-4 border-sky-100 bg-slate-50">
                            <img src={me?.selectedCharacter?.image} alt="You" className="w-full h-full object-cover" />
                        </div>
                        <span className="text-xs font-black text-sky-600 uppercase tracking-widest mb-1">Your Secret Character</span>
                        <h3 className="text-2xl font-black text-slate-900 text-center mb-6">{me?.selectedCharacter?.name}</h3>
                        <button
                            onClick={() => setShowMyCharacterModal(false)}
                            className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl transition-all active:scale-95"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* Leave Match Confirmation Modal (NFR-UX-04) */}
            {showLeaveConfirm && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[160] p-6 animate-in fade-in duration-200" onClick={() => setShowLeaveConfirm(false)}>
                    <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="w-14 h-14 bg-rose-50 text-rose-500 border border-rose-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">Leave Active Match?</h3>
                        <p className="text-slate-500 text-sm font-medium leading-relaxed mb-6">
                            Leaving now will end the game for both players.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowLeaveConfirm(false)}
                                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm rounded-xl transition-all active:scale-95"
                            >
                                Stay in Game
                            </button>
                            <button
                                onClick={leaveRoom}
                                className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-sm rounded-xl shadow-lg shadow-rose-600/20 transition-all active:scale-95"
                            >
                                Leave Match
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Make Your Guess Modal */}
            {guessModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 sm:p-6">
                    <div className="bg-white max-w-[95vw] sm:max-w-2xl w-fit rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
                        <div className="text-center mb-5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-sky-600 block mb-1">Final Deduction</span>
                            <h3 className="text-xl sm:text-2xl font-black text-slate-900">Guess Opponent&apos;s Secret Character</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto flex flex-wrap justify-center gap-2.5 sm:gap-3 pr-1">
                            {room.characters.filter(char => !eliminatedIds.includes(char.id)).map(char => (
                                <button
                                    key={char.id}
                                    onClick={() => handleGuess(char)}
                                    className="group relative bg-white rounded-2xl p-2 border border-slate-200 hover:border-sky-500 hover:bg-sky-50/30 shadow-sm transition-all transform hover:-translate-y-1 w-24 sm:w-28"
                                >
                                    <div className="aspect-[4/5] rounded-xl overflow-hidden mb-1.5 bg-slate-50">
                                        <img src={char.image} alt={char.name} className="w-full h-full object-cover" />
                                    </div>
                                    <p className="text-xs font-black text-slate-800 truncate">{char.name}</p>
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setGuessModalOpen(false)}
                            className="mt-6 w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black transition-all"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Victory / Game Over Modal */}
            {isGameOver && (
                <div className="fixed inset-0 bg-white/95 backdrop-blur-xl flex flex-col items-center justify-center z-[200] text-center p-8 animate-in fade-in zoom-in duration-300">
                    <div className="mb-10 relative">
                        <div className={`w-28 h-28 rounded-3xl mx-auto flex items-center justify-center shadow-2xl mb-6 ${won ? 'bg-emerald-500 shadow-emerald-200' : 'bg-rose-500 shadow-rose-200'}`}>
                            <span className="text-white text-5xl font-black">{won ? '✓' : '✗'}</span>
                        </div>
                        <h2 className={`text-5xl sm:text-6xl font-black mb-3 tracking-tight ${won ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {won ? 'VICTORY!' : 'GAME OVER'}
                        </h2>

                        {room.result?.message && (
                            <p className="text-xl font-black text-slate-900 mb-2">
                                {room.result.message}
                            </p>
                        )}

                        <p className="text-lg text-slate-500 font-medium">
                            The secret character was <span className="text-slate-900 font-black underline decoration-sky-500 decoration-4 underline-offset-4">{correctCharacter?.name}</span>
                        </p>

                        {user && (
                            <div className="mt-6 p-5 bg-slate-50 rounded-2xl border border-slate-200 inline-flex items-center gap-6">
                                <div className="text-left">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Career Record</span>
                                    <div className="flex items-center gap-4">
                                        <div className="flex flex-col">
                                            <span className="text-2xl font-black text-emerald-600 leading-none">{stats?.wins || 0}</span>
                                            <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">Wins</span>
                                        </div>
                                        <div className="w-[1px] h-8 bg-slate-200" />
                                        <div className="flex flex-col">
                                            <span className="text-2xl font-black text-rose-500 leading-none">{stats?.losses || 0}</span>
                                            <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">Losses</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-3 w-full max-w-xs">
                        <button
                            onClick={restartGame}
                            className="w-full py-4 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 rounded-2xl font-black text-lg text-white shadow-xl shadow-sky-600/25 transition-all transform hover:scale-[1.02] active:scale-95"
                        >
                            Play Again
                        </button>
                        <button
                            onClick={leaveRoom}
                            className="w-full py-3.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-2xl font-black text-base transition-all active:scale-95"
                        >
                            Main Menu
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GameBoard;
