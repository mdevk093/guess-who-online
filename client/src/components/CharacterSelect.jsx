import React, { useState, useEffect } from 'react';
import { useGame, decodeHtmlEntity } from '../context/GameContext';

const CharacterSelect = () => {
    const { room, playerName, startGame, selectCharacter, toggleRoomPublic, socket, leaveRoom, kickPlayer, pingRoomActivity } = useGame();
    const [mode, setMode] = useState('default'); // 'default', 'custom', or one of the preset keys
    const [presets, setPresets] = useState({});
    const [localCharacters, setLocalCharacters] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [timerEnabled, setTimerEnabled] = useState(false);
    const [timerLimit, setTimerLimit] = useState(2); // Default 2 minutes
    const [guessLimit, setGuessLimit] = useState(null); // null means infinite
    const [uploading, setUploading] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const isHost = room.players.find(p => p.id === socket.id)?.isHost;

    useEffect(() => {
        // Fetch presets
        fetch('/presets')
            .then(res => res.json())
            .then(data => setPresets(data));
    }, []);

    useEffect(() => {
        if (mode === 'default') {
            fetch('/defaultCharacters.json')
                .then(res => res.json())
                .then(data => setLocalCharacters(data));
        } else if (presets[mode]) {
            setLocalCharacters(presets[mode]);
        }
    }, [mode, presets]);

    const handleFileUpload = (e) => {
        const files = Array.from(e.target.files);
        if (files.length < 16 || files.length > 24) {
            alert("Please upload between 16 and 24 pictures.");
            return;
        }

        const customChars = files.map((file, index) => ({
            id: index + 1,
            name: `Person ${index + 1}`,
            image: URL.createObjectURL(file)
        }));
        setUploading(true);
        setTimeout(() => {
            setLocalCharacters(customChars);
            setUploading(false);
        }, 500);
    };

    const handleStart = () => {
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

    const handleSelect = (char) => {
        setSelectedId(char.id);
    };

    const me = room.players.find(p => p.id === socket.id);

    return (
        <div className="flex flex-col h-screen bg-slate-50 text-slate-900 overflow-hidden">
            {/* Header / Game Settings */}
            <div className="flex flex-col p-6 bg-white border-b border-slate-100 shadow-sm gap-6">

                {/* Top Bar: Title, Room Code, and Action Buttons */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between w-full gap-4 md:gap-6">
                    {/* Left: Title & Room Code */}
                    <div className="flex items-center gap-3 sm:gap-4 overflow-hidden w-full md:w-auto justify-between">
                        <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100 shrink-0">
                                <span className="text-white text-lg sm:text-xl font-black italic">?</span>
                            </div>
                            <div className="flex flex-col min-w-0">
                                <h2 className="text-base sm:text-xl font-extrabold text-slate-900 tracking-tight leading-tight truncate">Character Selection</h2>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">Room: <span className="text-indigo-600 font-black">{room.id}</span></p>
                                    <button
                                        onClick={copyJoinLink}
                                        className={`flex items-center gap-1 px-2 py-0.5 rounded-md border transition-all active:scale-95 ${copied
                                                ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                                                : 'bg-indigo-50 border-indigo-100 text-indigo-500 hover:bg-indigo-100 hover:border-indigo-200'
                                            }`}
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 012-2v-8a2 2 0 01-2-2h-8a2 2 0 01-2 2v8a2 2 0 012 2z"></path></svg>
                                        <span className="text-[9px] font-black uppercase tracking-tighter">{copied ? 'Copied!' : 'Copy Link'}</span>
                                    </button>
                                    {isHost && room.gameState === 'LOBBY' ? (
                                        <button
                                            type="button"
                                            onClick={() => toggleRoomPublic(!room.isPublic)}
                                            className={`flex items-center gap-1 px-2 py-0.5 rounded-md border transition-all active:scale-95 ${room.isPublic
                                                ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'
                                                : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
                                                }`}
                                            title="Toggle Public/Private Room"
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full ${room.isPublic ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                            <span className="text-[9px] font-black uppercase tracking-tighter">
                                                {room.isPublic ? 'Public' : 'Private'}
                                            </span>
                                        </button>
                                    ) : (
                                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-tighter ${room.isPublic
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                                            : 'bg-slate-100 border-slate-200 text-slate-500'
                                            }`}>
                                            {room.isPublic ? 'Public' : 'Private'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Mobile-only Player Indicator & Exit Button (shows on the right of title on mobile) */}
                        <div className="flex md:hidden items-center gap-2 shrink-0">
                            <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-colors ${room.players.length > 1
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : 'bg-slate-50 border-slate-200 text-slate-400'
                                }`}>
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path>
                                </svg>
                                <span className="text-[10px] font-black">{room.players.length}/2</span>
                            </div>

                            <button
                                onClick={() => room.players.length > 1 ? setShowLeaveConfirm(true) : leaveRoom()}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-500 hover:text-rose-600 rounded-xl transition-all shadow-sm active:scale-95 shrink-0"
                                title="Leave Room"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                            </button>
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-col md:flex-row items-center w-full md:w-auto gap-3 shrink-0">
                        {isHost && room.gameState === 'LOBBY' && (
                            <div className="flex items-center gap-2 w-full md:w-auto animate-in fade-in bg-slate-50/50 p-2 md:p-0 md:bg-transparent rounded-2xl border border-slate-100 md:border-none justify-between md:justify-end">
                                <button
                                    onClick={() => setIsSettingsOpen(true)}
                                    className="flex items-center justify-center gap-2 w-full md:w-auto p-2 sm:p-2.5 md:px-5 md:py-3 bg-white border border-slate-200 rounded-xl md:rounded-2xl text-slate-600 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm active:scale-95 text-sm md:text-base font-bold whitespace-nowrap"
                                    title="Game Settings"
                                >
                                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                    </svg>
                                    Customize Game
                                </button>

                                <button
                                    onClick={handleStart}
                                    disabled={localCharacters.length === 0}
                                    className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 px-4 py-2 sm:py-2.5 md:px-6 md:py-3 rounded-xl md:rounded-2xl font-black text-white transition-all transform hover:scale-[1.02] shadow-md shadow-indigo-200 active:scale-95 text-sm md:text-base whitespace-nowrap"
                                >
                                    {localCharacters.length === 0 ? "Loading..." : "Lock In Game Mode"}
                                </button>
                            </div>
                        )}

                        {room.gameState === 'LOBBY' && !isHost && (
                            <div className="flex items-center gap-3 bg-slate-100 px-4 py-3 md:py-2.5 rounded-xl border border-slate-200 animate-in zoom-in w-full md:w-auto justify-center md:justify-start">
                                <div className="w-2.5 h-2.5 bg-slate-400 rounded-full animate-pulse" />
                                <span className="text-xs sm:text-sm font-black text-slate-500 uppercase tracking-widest">Host is picking game mode...</span>
                            </div>
                        )}

                        {room.gameState === 'SELECTING' && (
                            <div className="flex items-center gap-3 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 animate-in zoom-in w-full md:w-auto justify-center md:justify-start">
                                <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" />
                                <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">Awaiting Selections</span>
                            </div>
                        )}

                        {/* Desktop Player Indicator & Exit Button (hidden on mobile, shown on md+) */}
                        <div className="hidden md:flex items-center gap-3">
                            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors ${room.players.length > 1
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : 'bg-slate-50 border-slate-200 text-slate-400'
                                }`}>
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path>
                                </svg>
                                <span className="text-xs font-black">{room.players.length}/2</span>
                            </div>

                            <button
                                onClick={() => room.players.length > 1 ? setShowLeaveConfirm(true) : leaveRoom()}
                                className="p-2 sm:p-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-500 hover:text-rose-600 rounded-xl transition-all shadow-sm active:scale-95"
                                title="Leave Room"
                            >
                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* Main Content */}
                <div className="flex-1 p-4 sm:p-8 overflow-y-auto">
                    {room.gameState === 'SELECTING' && (
                        <div className="mb-6 sm:mb-8 flex justify-center w-full animate-in slide-in-from-top-4 fade-in duration-300">
                            <div className="bg-slate-900 px-4 py-2 sm:px-6 sm:py-2.5 rounded-full shadow-md shadow-slate-200/50 flex items-center transform hover:scale-105 transition-transform">
                                <h3 className="text-sm font-black text-white tracking-widest uppercase">
                                    Choose Character
                                </h3>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1.5 sm:gap-6 pb-12 sm:pb-0">
                        {charactersToDisplay.map(char => (
                            <div
                                key={char.id}
                                onClick={() => {
                                    if (!me?.isReady) {
                                        setSelectedId(char.id);
                                        pingRoomActivity();
                                    }
                                }}
                                className={`group relative bg-white rounded-lg sm:rounded-3xl cursor-pointer transition-all duration-300 transform overflow-hidden ${!me?.isReady && 'hover:-translate-y-1 sm:hover:-translate-y-2'
                                    } border ${selectedId === char.id
                                        ? 'border-indigo-600 ring-2 sm:ring-4 ring-indigo-50 shadow-2xl scale-[1.02]'
                                        : 'border-slate-900/10 hover:border-indigo-100 shadow-lg shadow-slate-200/50'
                                    } ${me?.isReady ? 'opacity-50 grayscale pointer-events-none' : ''}`}
                            >
                                <div className="aspect-[4/5] p-0.5 sm:p-3 overflow-hidden rounded-t-lg sm:rounded-t-3xl text-center flex items-center justify-center">
                                    <img
                                        src={char.image}
                                        alt={char.name}
                                        className={`w-full h-full object-cover rounded-md sm:rounded-2xl transition-all duration-300 ${selectedId === char.id ? 'scale-110' : 'group-hover:scale-105'
                                            }`}
                                    />
                                </div>
                                <div className={`p-1 sm:p-4 text-center border-t border-slate-50 transition-colors ${selectedId === char.id ? 'bg-indigo-600' : 'bg-white'
                                    }`}>
                                    <p className={`text-[7px] sm:text-sm font-black truncate ${selectedId === char.id ? 'text-white' : 'text-slate-700'
                                        }`}>
                                        {char.name}
                                    </p>
                                </div>

                                {selectedId === char.id && (
                                    <div className="absolute top-4 right-4 bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-4 border-slate-50 animate-in zoom-in">
                                        <span className="font-black text-lg">✓</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Sidebar - Players */}
                <div className="w-full lg:w-80 p-4 sm:p-8 bg-white border-t lg:border-t-0 lg:border-l border-slate-100 flex flex-col gap-4 sm:gap-8 overflow-y-auto">
                    <div>
                        <h3 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 sm:mb-4">Players Connected</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-1 gap-2 sm:gap-3">
                            {room.players.map(p => (
                                <div key={p.id} className={`flex items-center justify-between gap-2 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all ${p.isReady ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'
                                    }`}>
                                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                        <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shadow-sm shrink-0 ${p.isReady ? 'bg-emerald-500 shadow-emerald-200 animate-pulse' : 'bg-slate-300'}`} />
                                        <span className={`font-bold text-xs sm:text-base truncate ${p.isReady ? 'text-emerald-700' : 'text-slate-600'}`}>
                                            {decodeHtmlEntity(p.name)} {p.id === socket.id && "(You)"}
                                        </span>
                                    </div>
                                    {isHost && p.id !== socket.id && (room.gameState === 'LOBBY' || room.gameState === 'SELECTING') && (
                                        <button
                                            type="button"
                                            onClick={() => kickPlayer(p.id)}
                                            className="px-2 sm:px-2.5 py-1 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 hover:border-rose-600 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 shrink-0"
                                            title={`Remove ${decodeHtmlEntity(p.name)} from lobby`}
                                        >
                                            Kick
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <button
                        disabled={!selectedId || me?.isReady || room.gameState !== 'SELECTING'}
                        onClick={() => selectCharacter(charactersToDisplay.find(c => c.id === selectedId))}
                        className="mt-auto w-full py-4 sm:py-5 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all disabled:opacity-50 disabled:grayscale active:scale-95 shadow-xl text-base sm:text-lg overflow-hidden relative group"
                    >
                        <div className="absolute inset-0 bg-white/10 w-full h-full transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300 pointer-events-none" />
                        <span className="relative z-10">
                            {me?.isReady ? "Locked In (Waiting...)" : "Lock Character"}
                        </span>
                    </button>
                </div>
            </div>

            {/* Leave Confirmation Modal (NFR-UX-04) */}
            {showLeaveConfirm && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[150] p-6 animate-in fade-in duration-200" onClick={() => setShowLeaveConfirm(false)}>
                    <div className="bg-white rounded-[2rem] p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
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
                                className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-sm rounded-xl shadow-lg shadow-rose-100 transition-all active:scale-95"
                            >
                                Leave Room
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom-Sheet Settings Modal for Host */}
            {isSettingsOpen && isHost && room.gameState === 'LOBBY' && (
                <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsSettingsOpen(false)}>
                    <div
                        className="bg-white w-full sm:w-[400px] rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300 transform-gpu border border-slate-100"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Drag Handle (Mobile) */}
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 sm:hidden"></div>

                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">Game Settings</h3>
                            <button
                                onClick={() => setIsSettingsOpen(false)}
                                className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Room Visibility Toggle */}
                            <div className="flex flex-col items-start">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Lobby Visibility</span>
                                <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 w-full">
                                    <button
                                        type="button"
                                        onClick={() => toggleRoomPublic(true)}
                                        className={`px-4 py-2.5 rounded-xl text-xs font-black tracking-widest transition-all shadow-sm flex-1 ${room.isPublic ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700 bg-white border border-slate-200'}`}
                                    >
                                        🌐 PUBLIC
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => toggleRoomPublic(false)}
                                        className={`px-4 py-2.5 rounded-xl text-xs font-black tracking-widest transition-all shadow-sm flex-1 ${!room.isPublic ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700 bg-white border border-slate-200'}`}
                                    >
                                        🔒 PRIVATE
                                    </button>
                                </div>
                            </div>

                            {/* Theme */}
                            <div className="flex flex-col items-start cursor-pointer group" onClick={() => document.getElementById('themeSelect').focus()}>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 group-hover:text-indigo-600 transition-colors">Theme Pattern</span>
                                <select
                                    id="themeSelect"
                                    value={mode}
                                    onChange={(e) => setMode(e.target.value)}
                                    className="bg-slate-50 text-slate-700 w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-100 font-bold transition-all text-sm appearance-none cursor-pointer"
                                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em`, paddingRight: `2.5rem` }}
                                >
                                    <option value="default">Default</option>
                                    <option value="marvel_dc">Marvel & DC</option>
                                    <option value="youtubers">YouTubers</option>
                                    <option value="fruits_veg">Fruits & Veg</option>
                                    <option value="anime">Anime</option>
                                    <option value="countries">Countries</option>
                                    <option value="custom">Custom</option>
                                </select>
                            </div>

                            {/* Turn Timer Configuration */}
                            <div className="flex flex-col items-start border-t border-slate-100 pt-6">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Turn Timer Limit</span>
                                <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 w-full">
                                    <button
                                        onClick={() => setTimerEnabled(!timerEnabled)}
                                        className={`px-4 py-2.5 rounded-xl text-xs font-black tracking-widest transition-all shadow-sm ${timerEnabled ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-600 bg-white'}`}
                                    >
                                        {timerEnabled ? "ON" : "OFF"}
                                    </button>
                                    {timerEnabled && (
                                        <div className="flex items-center gap-2 pr-2 border-l border-slate-200 ml-2 pl-2 overflow-x-auto hide-scrollbar flex-1">
                                            {[1, 2, 3].map(min => (
                                                <button
                                                    key={min}
                                                    onClick={() => setTimerLimit(min)}
                                                    className={`w-10 h-10 flex-1 flex items-center justify-center rounded-xl text-sm font-black transition-all shadow-sm ${timerLimit === min ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700 bg-white border border-slate-200'}`}
                                                >
                                                    {min}m
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Guessing Limit Configuration */}
                            <div className="flex flex-col items-start border-t border-slate-100 pt-6">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Guess Attempts allowed</span>
                                <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 w-full">
                                    <button
                                        onClick={() => setGuessLimit(null)}
                                        className={`px-4 py-2.5 rounded-xl text-xs font-black tracking-widest transition-all shadow-sm flex-1 ${guessLimit === null ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700 bg-white border border-slate-200'}`}
                                    >
                                        ∞ UNLIMITED
                                    </button>
                                    {[1, 3].map(limit => (
                                        <button
                                            key={limit}
                                            onClick={() => setGuessLimit(limit)}
                                            className={`w-12 h-10 flex items-center justify-center rounded-xl text-sm font-black transition-all shadow-sm ${guessLimit === limit ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700 bg-white border border-slate-200'}`}
                                        >
                                            {limit}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={() => setIsSettingsOpen(false)}
                                className="w-full mt-4 bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-2xl transition-colors active:scale-95 shadow-lg"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CharacterSelect;
