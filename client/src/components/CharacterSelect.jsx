import React, { useState, useEffect, useRef } from 'react';
import { useGame, decodeHtmlEntity } from '../context/GameContext';
import Chat from './Chat';

const THEME_DECKS = [
    {
        id: 'default',
        title: 'Classic Board',
        emoji: '🎭',
        desc: 'Original iconic faces and classic characteristics.'
    },
    {
        id: 'countries',
        title: 'World Countries',
        emoji: '🌍',
        desc: 'Deduce capitals, flags, continents, and geography.'
    },
    {
        id: 'marvel_dc',
        title: 'Superheroes',
        emoji: '🦸‍♂️',
        desc: 'Masks, capes, powers, and hero origins.'
    },
    {
        id: 'anime',
        title: 'Anime Legends',
        emoji: '⚔️',
        desc: 'Iconic anime heroes, rivals, and signature styles.'
    },
    {
        id: 'youtubers',
        title: 'YouTubers',
        emoji: '📹',
        desc: 'Creators, streamers, and internet personalities.'
    },
    {
        id: 'fruits_veg',
        title: 'Fruits & Veg',
        emoji: '🍎',
        desc: 'Colorful produce, textures, and botanical traits.'
    },
    {
        id: 'custom',
        title: 'Custom Upload',
        emoji: '✨',
        desc: 'Upload 16–24 of your own family or friend photos (Cloud Sync).',
        isCustom: true,
        isLocked: true
    }
];

const getInitials = (name) => {
    if (!name) return 'P2';
    const clean = decodeHtmlEntity(name).trim();
    return clean.slice(0, 2).toUpperCase();
};

const CharacterSelect = () => {
    const { room, startGame, selectCharacter, restartGame, toggleRoomPublic, socket, leaveRoom, kickPlayer, pingRoomActivity, error } = useGame();
    const [mode, setMode] = useState('default');
    const [presets, setPresets] = useState({});
    const [localCharacters, setLocalCharacters] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [timerEnabled, setTimerEnabled] = useState(false);
    const [timerLimit, setTimerLimit] = useState(2);
    const [guessLimit, setGuessLimit] = useState(null);
    const [copied, setCopied] = useState(false);
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const [showDeckPreview, setShowDeckPreview] = useState(false);
    const [proNotice, setProNotice] = useState('');
    const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const lastChatLengthRef = useRef(room?.chat?.length || 0);

    const isHost = room.players.find(p => p.id === socket.id)?.isHost;
    const me = room.players.find(p => p.id === socket.id);
    const opponent = room.players.find(p => p.id !== socket.id);
    const connectedPlayersCount = room.players.filter(p => p.connected !== false).length;
    const hasTwoPlayers = connectedPlayersCount >= 2;

    // Track unread messages for mobile chat drawer
    useEffect(() => {
        const currentLen = room?.chat?.length || 0;
        if (currentLen > lastChatLengthRef.current) {
            const latestMsg = room.chat[currentLen - 1];
            if (!isMobileChatOpen && latestMsg && latestMsg.sender !== socket.id && latestMsg.type !== 'DIVIDER') {
                setUnreadCount(prev => prev + 1);
            }
        }
        lastChatLengthRef.current = currentLen;
    }, [room?.chat?.length, isMobileChatOpen, room?.chat, socket.id]);

    useEffect(() => {
        if (isMobileChatOpen) {
            setUnreadCount(0);
        }
    }, [isMobileChatOpen]);

    // Clear selectedId whenever returning to LOBBY (e.g. after kicking a player in SELECTING or starting a rematch)
    useEffect(() => {
        if (room.gameState === 'LOBBY') {
            setSelectedId(null);
        }
    }, [room.gameState]);

    useEffect(() => {
        fetch('/presets')
            .then(res => res.json())
            .then(data => setPresets(data))
            .catch(err => console.error('Failed to fetch presets:', err));
    }, []);

    useEffect(() => {
        if (mode === 'default') {
            fetch('/defaultCharacters.json')
                .then(res => res.json())
                .then(data => setLocalCharacters(data))
                .catch(err => console.error('Failed to fetch default characters:', err));
        } else if (presets[mode]) {
            setLocalCharacters(presets[mode]);
        }
    }, [mode, presets]);

    const handleDeckClick = (deck) => {
        if (!isHost || room.gameState !== 'LOBBY') return;
        pingRoomActivity();
        if (deck.isLocked) {
            setProNotice('Custom photo decks with multiplayer cloud sync are available in the Pro Tier!');
            setTimeout(() => setProNotice(''), 4000);
            return;
        }
        setProNotice('');
        setMode(deck.id);
    };

    const handleStart = () => {
        if (!hasTwoPlayers) return;
        if (localCharacters.length > 0) {
            startGame(localCharacters, {
                timerLimit: timerEnabled ? timerLimit : null,
                guessLimit: guessLimit
            });
        }
    };

    const copyJoinLink = () => {
        const joinLink = `${window.location.origin}?room=${room.id}`;
        navigator.clipboard.writeText(joinLink).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const charactersToDisplay = (room.characters && room.characters.length > 0) ? room.characters : localCharacters;
    const selectedCharObj = charactersToDisplay.find(c => c.id === selectedId);

    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-800 p-4 md:p-8 flex flex-col">
            <div className="max-w-7xl w-full mx-auto space-y-6 flex-1 flex flex-col">

                {/* Top App Header */}
                <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-600 shadow-lg shadow-sky-500/25 flex items-center justify-center font-black text-white text-xl shrink-0">
                            ?
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
                                Guess Who?
                                <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full border bg-sky-50 border-sky-200 text-sky-700">
                                    {room.gameState === 'LOBBY' ? 'Match Setup' : 'Secret Selection'}
                                </span>
                            </h1>
                            <p className="text-xs text-slate-500">
                                {room.gameState === 'LOBBY'
                                    ? 'Configure match rules, invite an opponent, and choose a character deck.'
                                    : 'Pick the secret character your opponent will try to deduce!'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 self-start sm:self-auto">
                        {/* Room Code Pill */}
                        <div className="flex items-center gap-2 p-1.5 rounded-2xl border bg-slate-50 border-slate-200">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-2">Code:</span>
                            <span className="text-sm sm:text-base font-black tracking-widest px-3 py-1 rounded-xl border bg-white border-slate-200 text-slate-900">
                                {room.id}
                            </span>
                            <button
                                onClick={copyJoinLink}
                                className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all text-white shadow-sm active:scale-95 ${copied ? 'bg-emerald-600' : 'bg-sky-600 hover:bg-sky-500'
                                    }`}
                            >
                                {copied ? '✓ Copied' : 'Copy Link'}
                            </button>
                        </div>

                        <button
                            onClick={() => room.players.length > 1 ? setShowLeaveConfirm(true) : leaveRoom()}
                            className="p-2.5 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-500 hover:text-rose-600 rounded-2xl transition-all shadow-sm active:scale-95"
                            title="Leave Lobby"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                        </button>
                    </div>
                </header>

                {/* ============================================================= */}
                {/* LAYOUT A: 8-COL SETUP/SELECTION + 4-COL PERSISTENT LOBBY CHAT */}
                {/* ============================================================= */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-1">

                    {/* LEFT 8 COLUMNS: MATCH SETUP OR SECRET SUSPECT GRID */}
                    <div className="lg:col-span-8 w-full">
                        {room.gameState === 'LOBBY' && (
                            <div className="rounded-3xl p-6 lg:p-7 shadow-sm border bg-white border-slate-200 space-y-7 animate-in fade-in duration-300">

                                {/* Card Sub-Header */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                                    <div>
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-xs font-black uppercase tracking-widest text-sky-600">
                                                {isHost ? 'Host Lobby' : 'Player Lobby'}
                                            </span>
                                            {isHost ? (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleRoomPublic(!room.isPublic)}
                                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all flex items-center gap-1.5 ${room.isPublic
                                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                                        : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                                                        }`}
                                                    title="Click to toggle Public / Private visibility"
                                                >
                                                    <span className={`w-1.5 h-1.5 rounded-full ${room.isPublic ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                                    {room.isPublic ? 'Public Room' : 'Private Room'}
                                                </button>
                                            ) : (
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${room.isPublic
                                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                                    : 'bg-slate-100 border-slate-200 text-slate-600'
                                                    }`}>
                                                    {room.isPublic ? 'Public Room' : 'Private Room'}
                                                </span>
                                            )}
                                        </div>
                                        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 mt-1">
                                            Configure Match & Select Theme
                                        </h2>
                                    </div>

                                    {isHost && (
                                        <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
                                            <button
                                                type="button"
                                                onClick={() => toggleRoomPublic(true)}
                                                className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${room.isPublic
                                                    ? 'bg-sky-600 text-white shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-800'
                                                    }`}
                                            >
                                                🌐 Public
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => toggleRoomPublic(false)}
                                                className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${!room.isPublic
                                                    ? 'bg-slate-800 text-white shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-800'
                                                    }`}
                                            >
                                                🔒 Private
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Players Section */}
                                <div>
                                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">
                                        Lobby Players ({room.players.length}/2)
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                        {/* Me */}
                                        <div className="rounded-2xl p-3.5 flex items-center justify-between border bg-white border-sky-300 shadow-sm shadow-sky-100">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-9 h-9 rounded-xl font-black text-xs text-white bg-sky-600 flex items-center justify-center shrink-0">
                                                    YOU
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-black text-slate-900 flex items-center gap-2 truncate">
                                                        <span className="truncate">{decodeHtmlEntity(me?.name)}</span>
                                                        {me?.isHost && (
                                                            <span className="text-[10px] px-2 py-0.5 rounded-md font-bold uppercase border bg-sky-50 text-sky-700 border-sky-200 shrink-0">
                                                                Host
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] font-bold text-emerald-600">Ready in Lobby</div>
                                                </div>
                                            </div>
                                            <span className="text-emerald-500 text-lg font-black shrink-0">✓</span>
                                        </div>

                                        {/* Opponent or Waiting Slot */}
                                        {opponent ? (
                                            <div className="rounded-2xl p-3.5 flex items-center justify-between border bg-white border-slate-200">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-9 h-9 rounded-xl border font-black text-xs bg-indigo-50 text-indigo-700 border-indigo-200 flex items-center justify-center shrink-0">
                                                        {getInitials(opponent.name)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-black text-slate-900 flex items-center gap-2 truncate">
                                                            <span className="truncate">{decodeHtmlEntity(opponent.name)}</span>
                                                            {opponent.isHost && (
                                                                <span className="text-[10px] px-2 py-0.5 rounded-md font-bold uppercase border bg-sky-50 text-sky-700 border-sky-200 shrink-0">
                                                                    Host
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[11px] font-bold text-amber-600">
                                                            {opponent.isHost ? 'Configuring match settings...' : 'Connected in lobby'}
                                                        </div>
                                                    </div>
                                                </div>
                                                {isHost && (
                                                    <button
                                                        type="button"
                                                        onClick={() => kickPlayer(opponent.id)}
                                                        className="text-xs font-bold px-2.5 py-1 rounded-lg border text-rose-600 border-rose-200 hover:bg-rose-50 transition-all shrink-0 active:scale-95"
                                                        title={`Remove ${decodeHtmlEntity(opponent.name)} from lobby`}
                                                    >
                                                        Kick
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="rounded-2xl p-3.5 flex items-center justify-between border border-dashed border-slate-300 bg-slate-50/60">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-400 font-black text-sm flex items-center justify-center">
                                                        ?
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-slate-600">Waiting for Opponent...</div>
                                                        <div className="text-[11px] text-slate-400">Share code <strong className="text-slate-700">{room.id}</strong> or invite link</div>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={copyJoinLink}
                                                    className="text-xs font-bold px-3 py-1.5 rounded-lg border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 transition-all shrink-0"
                                                >
                                                    {copied ? 'Copied!' : 'Invite'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Visual Theme Decks (Host Interactive / Guest Informative) */}
                                <div className="space-y-3.5">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                                                Select Character Theme
                                            </h3>
                                            <span className="text-xs font-bold text-sky-600">
                                                {localCharacters.length || 24} Suspect Cards
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setShowDeckPreview(!showDeckPreview)}
                                            className="text-xs font-bold text-sky-600 hover:text-sky-700 underline underline-offset-4"
                                        >
                                            {showDeckPreview ? 'Hide Deck Preview ▲' : 'Preview Suspect Cards ▼'}
                                        </button>
                                    </div>

                                    {proNotice && (
                                        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center justify-between animate-in fade-in duration-200">
                                            <span>🔒 {proNotice}</span>
                                            <button type="button" onClick={() => setProNotice('')} className="text-amber-600 hover:text-amber-900 font-black px-2">✕</button>
                                        </div>
                                    )}

                                    {error && (
                                        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold animate-in fade-in duration-200">
                                            {decodeHtmlEntity(error)}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                                        {THEME_DECKS.map((deck) => {
                                            const isActive = mode === deck.id;
                                            return (
                                                <div
                                                    key={deck.id}
                                                    onClick={() => handleDeckClick(deck)}
                                                    className={`relative rounded-2xl p-3.5 text-left transition-all ${isHost ? 'cursor-pointer' : 'cursor-default'} ${isActive
                                                        ? 'bg-sky-50/50 border-2 border-sky-500 shadow-md shadow-sky-100 transform -translate-y-0.5'
                                                        : `bg-white border border-slate-200 hover:border-slate-300 shadow-sm ${deck.isLocked ? 'border-dashed bg-slate-50/60 opacity-85' : ''}`
                                                        }`}
                                                >
                                                    <div className={`w-full h-16 rounded-xl mb-2.5 flex items-center justify-center text-2xl overflow-hidden relative border ${isActive
                                                        ? 'bg-white border-sky-200'
                                                        : 'bg-slate-50 border-slate-200'
                                                        }`}>
                                                        <span>{deck.emoji}</span>
                                                        {isActive && (
                                                            <span className="absolute top-1.5 right-1.5 text-[9px] font-black uppercase tracking-wider bg-sky-600 text-white px-2 py-0.5 rounded-md">
                                                                Active
                                                            </span>
                                                        )}
                                                        {deck.isLocked && (
                                                            <span className="absolute top-1.5 right-1.5 text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md">
                                                                🔒 Pro Tier
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <h4 className="text-xs sm:text-sm font-black text-slate-900">{deck.title}</h4>
                                                        {deck.isCustom && (
                                                            <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border bg-amber-100 text-amber-800 border-amber-200">
                                                                PRO
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">{deck.desc}</p>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Collapsible Suspects Preview */}
                                    {showDeckPreview && localCharacters.length > 0 && (
                                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 animate-in fade-in duration-200">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                                                    Deck Preview ({localCharacters.length} Suspects)
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5 max-h-60 overflow-y-auto pr-1">
                                                {localCharacters.map((char) => (
                                                    <div key={char.id} className="bg-white rounded-xl p-1.5 border border-slate-200 text-center shadow-sm">
                                                        <div className="aspect-[4/5] rounded-lg overflow-hidden bg-slate-50 mb-1">
                                                            <img src={char.image} alt={char.name} className="w-full h-full object-cover" />
                                                        </div>
                                                        <div className="text-[10px] font-bold text-slate-700 truncate">{char.name}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Rules & Timer Options */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                                    {/* Turn Timer Box */}
                                    <div className="space-y-2.5 rounded-2xl p-4 border bg-slate-50/70 border-slate-200">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Turn Timer Limit</h4>
                                                <p className="text-[10px] text-slate-500">Forces turn to pass if player takes too long</p>
                                            </div>
                                            <span className="text-xs font-black text-sky-600">
                                                {timerEnabled ? `${timerLimit} Minute${timerLimit > 1 ? 's' : ''}` : 'Off'}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 pt-1">
                                            <button
                                                type="button"
                                                disabled={!isHost}
                                                onClick={() => setTimerEnabled(false)}
                                                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${!timerEnabled
                                                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                                                    : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-700'
                                                    } ${!isHost ? 'opacity-70 cursor-not-allowed' : ''}`}
                                            >
                                                Off
                                            </button>
                                            {[1, 2, 3].map((min) => {
                                                const active = timerEnabled && timerLimit === min;
                                                return (
                                                    <button
                                                        key={min}
                                                        type="button"
                                                        disabled={!isHost}
                                                        onClick={() => {
                                                            setTimerEnabled(true);
                                                            setTimerLimit(min);
                                                        }}
                                                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${active
                                                            ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                                                            : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-700'
                                                            } ${!isHost ? 'opacity-70 cursor-not-allowed' : ''}`}
                                                    >
                                                        {min}m
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Guess Limit Box */}
                                    <div className="space-y-2.5 rounded-2xl p-4 border bg-slate-50/70 border-slate-200">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Guess Attempts Allowed</h4>
                                                <p className="text-[10px] text-slate-500">Run out of guesses and your opponent wins</p>
                                            </div>
                                            <span className="text-xs font-black text-sky-600">
                                                {guessLimit === null ? 'Unlimited' : guessLimit === 1 ? '1 (Sudden Death)' : `${guessLimit} Guesses`}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 pt-1">
                                            <button
                                                type="button"
                                                disabled={!isHost}
                                                onClick={() => setGuessLimit(null)}
                                                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${guessLimit === null
                                                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                                                    : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-700'
                                                    } ${!isHost ? 'opacity-70 cursor-not-allowed' : ''}`}
                                            >
                                                ∞ Unlimited
                                            </button>
                                            <button
                                                type="button"
                                                disabled={!isHost}
                                                onClick={() => setGuessLimit(3)}
                                                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${guessLimit === 3
                                                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                                                    : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-700'
                                                    } ${!isHost ? 'opacity-70 cursor-not-allowed' : ''}`}
                                            >
                                                3
                                            </button>
                                            <button
                                                type="button"
                                                disabled={!isHost}
                                                onClick={() => setGuessLimit(1)}
                                                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${guessLimit === 1
                                                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                                                    : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-700'
                                                    } ${!isHost ? 'opacity-70 cursor-not-allowed' : ''}`}
                                            >
                                                1 Sudden Death
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => room.players.length > 1 ? setShowLeaveConfirm(true) : leaveRoom()}
                                        className="w-full sm:w-auto px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all"
                                    >
                                        Leave Lobby
                                    </button>

                                    {isHost ? (
                                        <button
                                            type="button"
                                            onClick={handleStart}
                                            disabled={!hasTwoPlayers || localCharacters.length === 0}
                                            title={!hasTwoPlayers ? 'Invite an opponent to join before starting' : ''}
                                            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl text-sm font-black uppercase tracking-wider text-white bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 shadow-xl shadow-sky-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] disabled:hover:scale-100 active:scale-95"
                                        >
                                            {!hasTwoPlayers
                                                ? 'Waiting for Opponent (1/2)...'
                                                : localCharacters.length === 0
                                                    ? 'Loading Deck...'
                                                    : 'Lock In Game Mode & Start →'}
                                        </button>
                                    ) : (
                                        <div className="w-full sm:w-auto px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
                                            Host is configuring game mode...
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {room.gameState === 'SELECTING' && (
                            <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5 animate-in fade-in duration-300">
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-sky-600 block">Step 2 of 2</span>
                                        <h2 className="text-lg sm:text-xl font-black text-slate-900">Choose Your Secret Suspect</h2>
                                    </div>
                                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-700">
                                        {me?.isReady ? '✓ Secret Suspect Locked In' : selectedCharObj ? `Selected: ${selectedCharObj.name}` : 'Click any suspect card below'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5 sm:gap-3.5">
                                    {charactersToDisplay.map((char) => {
                                        const isSelected = selectedId === char.id;
                                        return (
                                            <div
                                                key={char.id}
                                                onClick={() => {
                                                    if (!me?.isReady) {
                                                        setSelectedId(char.id);
                                                        pingRoomActivity();
                                                    }
                                                }}
                                                className={`group relative rounded-2xl p-2 text-center transition-all cursor-pointer transform ${!me?.isReady ? 'hover:-translate-y-1' : 'opacity-60 pointer-events-none'
                                                    } ${isSelected
                                                        ? 'bg-white border-2 border-sky-500 shadow-lg shadow-sky-100 ring-2 ring-sky-100'
                                                        : 'bg-white border border-slate-200 hover:border-sky-400 shadow-sm'
                                                    }`}
                                            >
                                                <div className="aspect-[4/5] rounded-xl overflow-hidden mb-2 relative bg-slate-50">
                                                    <img
                                                        src={char.image}
                                                        alt={char.name}
                                                        className={`w-full h-full object-cover transition-transform duration-300 ${isSelected ? 'scale-105' : 'group-hover:scale-105'}`}
                                                    />
                                                    {isSelected && (
                                                        <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-sky-600 text-white flex items-center justify-center text-xs font-black shadow">
                                                            ✓
                                                        </div>
                                                    )}
                                                </div>
                                                <div className={`text-xs font-black truncate ${isSelected ? 'text-sky-700' : 'text-slate-900'}`}>
                                                    {char.name}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT 4 COLUMNS: SECRET LOCK-IN (WHEN SELECTING) + PERSISTENT LOBBY CHAT */}
                    <div className="lg:col-span-4 w-full flex flex-col gap-5 lg:sticky lg:top-6">
                        {room.gameState === 'SELECTING' && (
                            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col gap-4">
                                <div>
                                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2.5">
                                        Match Players ({room.players.length}/2)
                                    </h3>
                                    <div className="space-y-2">
                                        {room.players.map((p) => (
                                            <div
                                                key={p.id}
                                                className={`flex items-center justify-between gap-2 p-2.5 rounded-2xl border transition-all ${p.isReady
                                                    ? 'bg-emerald-50/70 border-emerald-200'
                                                    : 'bg-slate-50 border-slate-200'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${p.isReady ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
                                                    <div className="min-w-0">
                                                        <div className="font-black text-xs text-slate-900 truncate">
                                                            {decodeHtmlEntity(p.name)} {p.id === socket.id && '(You)'}
                                                        </div>
                                                        <div className={`text-[10px] font-bold ${p.isReady ? 'text-emerald-600' : 'text-slate-500'}`}>
                                                            {p.isReady ? 'Locked In ✓' : 'Choosing suspect...'}
                                                        </div>
                                                    </div>
                                                </div>

                                                {isHost && p.id !== socket.id && (
                                                    <button
                                                        type="button"
                                                        onClick={() => kickPlayer(p.id)}
                                                        className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shrink-0"
                                                        title={`Remove ${decodeHtmlEntity(p.name)} from lobby`}
                                                    >
                                                        Kick
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Selected Suspect Preview Box */}
                                <div className="p-3.5 rounded-2xl border bg-slate-50 border-slate-200 text-center">
                                    {selectedCharObj ? (
                                        <div className="flex items-center gap-3 text-left">
                                            <div className="w-12 h-12 rounded-xl border-2 border-sky-400 bg-sky-50 overflow-hidden shrink-0 p-0.5">
                                                <img src={selectedCharObj.image} alt={selectedCharObj.name} className="w-full h-full object-cover rounded-lg" />
                                            </div>
                                            <div className="min-w-0">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-sky-600 block">Your Secret Pick</span>
                                                <span className="text-sm font-black text-slate-900 truncate block">{selectedCharObj.name}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-xs font-bold text-slate-400 py-1.5">
                                            Select a suspect from the board to lock in
                                        </p>
                                    )}
                                </div>

                                <button
                                    disabled={!selectedId || me?.isReady}
                                    onClick={() => selectCharacter(selectedCharObj)}
                                    className="w-full py-3.5 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider text-white bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 shadow-lg shadow-sky-600/25 transition-all disabled:opacity-40 disabled:pointer-events-none active:scale-95"
                                >
                                    {me?.isReady ? '✓ Locked In (Waiting...)' : 'Lock Character →'}
                                </button>

                                {isHost && (
                                    <button
                                        type="button"
                                        onClick={restartGame}
                                        className="w-full py-2 rounded-xl font-bold text-xs text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all"
                                    >
                                        ← Back to Match Setup
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Desktop Persistent Lobby Chat Panel */}
                        <div className={`hidden lg:flex flex-col w-full ${room.gameState === 'LOBBY' ? 'h-[620px]' : 'h-[420px]'}`}>
                            <Chat isOpen={true} />
                        </div>
                    </div>
                </div>

                {/* Mobile Floating Chat Drawer Button (< lg viewports) */}
                <button
                    type="button"
                    onClick={() => setIsMobileChatOpen(true)}
                    className="lg:hidden fixed bottom-5 right-5 z-[120] flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-black text-xs uppercase tracking-wider shadow-xl shadow-sky-600/30 active:scale-95 transition-all"
                >
                    <span>💬 Lobby Chat</span>
                    {unreadCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black animate-bounce">
                            {unreadCount}
                        </span>
                    )}
                </button>

                {/* Mobile Slide-Over Lobby Chat Drawer (< lg viewports) */}
                {isMobileChatOpen && (
                    <div
                        className="lg:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[140] flex justify-end animate-in fade-in duration-200"
                        onClick={() => setIsMobileChatOpen(false)}
                    >
                        <div
                            className="w-full max-w-md h-full bg-[#f8fafc] p-3 flex flex-col gap-2 shadow-2xl animate-in slide-in-from-right duration-200"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between px-2 py-1">
                                <span className="text-xs font-black uppercase tracking-wider text-slate-600">Lobby Chat</span>
                                <button
                                    type="button"
                                    onClick={() => setIsMobileChatOpen(false)}
                                    className="px-3 py-1 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:text-slate-900"
                                >
                                    Close ✕
                                </button>
                            </div>
                            <div className="flex-1 min-h-0">
                                <Chat isOpen={isMobileChatOpen} />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Leave Confirmation Modal (NFR-UX-04) */}
            {showLeaveConfirm && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[150] p-6 animate-in fade-in duration-200" onClick={() => setShowLeaveConfirm(false)}>
                    <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="w-14 h-14 bg-rose-50 text-rose-500 border border-rose-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">Leave Lobby?</h3>
                        <p className="text-slate-500 text-sm font-medium leading-relaxed mb-6">
                            Leaving now will close the room for both players.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowLeaveConfirm(false)}
                                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm rounded-xl transition-all active:scale-95"
                            >
                                Stay
                            </button>
                            <button
                                onClick={leaveRoom}
                                className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-sm rounded-xl shadow-lg shadow-rose-600/20 transition-all active:scale-95"
                            >
                                Leave Room
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CharacterSelect;
