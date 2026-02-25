import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';

const CharacterSelect = () => {
    const { room, playerName, startGame, selectCharacter, socket, leaveRoom } = useGame();
    const [mode, setMode] = useState('default'); // 'default', 'custom', or one of the preset keys
    const [presets, setPresets] = useState({});
    const [localCharacters, setLocalCharacters] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [timerEnabled, setTimerEnabled] = useState(false);
    const [timerLimit, setTimerLimit] = useState(2); // Default 2 minutes
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
        setLocalCharacters(customChars);
    };

    const handleStart = () => {
        if (localCharacters.length > 0) {
            startGame(localCharacters, {
                timerLimit: timerEnabled ? timerLimit : null
            });
        }
    };

    const charactersToDisplay = (room.characters && room.characters.length > 0) ? room.characters : localCharacters;

    const handleSelect = (char) => {
        setSelectedId(char.id);
    };

    const me = room.players.find(p => p.id === socket.id);

    return (
        <div className="flex flex-col h-screen bg-slate-50 text-slate-900 overflow-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 bg-white border-b border-slate-100 shadow-sm gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
                        <span className="text-white text-lg sm:text-xl font-black italic">?</span>
                    </div>
                    <div>
                        <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight leading-tight">Character Selection</h2>
                        <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">Room: <span className="text-indigo-600 font-black">{room.id}</span></p>
                    </div>
                </div>

                {isHost && room.gameState === 'LOBBY' && (
                    <div className="flex flex-wrap items-center justify-start sm:justify-end gap-3 sm:gap-4 animate-in fade-in slide-in-from-top-4 w-full sm:w-auto">
                        <div className="flex flex-col items-start sm:items-center flex-1 sm:flex-none">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Select Theme</span>
                            <select
                                value={mode}
                                onChange={(e) => setMode(e.target.value)}
                                className="w-full sm:w-auto bg-slate-50 text-slate-700 px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-100 font-bold transition-all text-sm"
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
                        <div className="flex flex-col items-start sm:items-center sm:border-l sm:border-slate-100 sm:pl-4 sm:pl-6 flex-1 sm:flex-none">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Turn Timer</span>
                            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200 w-full sm:w-auto justify-center sm:justify-start">
                                <button
                                    onClick={() => setTimerEnabled(!timerEnabled)}
                                    className={`px-3 py-1 rounded-lg text-[10px] font-black tracking-widest transition-all ${timerEnabled ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {timerEnabled ? "ON" : "OFF"}
                                </button>
                                {timerEnabled && (
                                    <div className="flex items-center gap-1 pr-1 border-l border-slate-200 ml-1 pl-1">
                                        {[1, 2, 3, 4, 5].map(min => (
                                            <button
                                                key={min}
                                                onClick={() => setTimerLimit(min)}
                                                className={`w-6 h-6 flex items-center justify-center rounded-lg text-[10px] font-black transition-all ${timerLimit === min ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                {min}
                                            </button>
                                        ))}
                                        <span className="text-[7px] font-black text-slate-400 uppercase ml-1">min</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex w-full sm:w-auto gap-2">
                            <button
                                onClick={handleStart}
                                disabled={localCharacters.length === 0}
                                className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 px-4 sm:px-8 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-black text-white transition-all transform hover:scale-[1.02] shadow-xl shadow-indigo-200 active:scale-95 text-xs sm:text-base"
                            >
                                {localCharacters.length === 0 ? "Loading..." : "Lock In Game Mode"}
                            </button>
                            <button
                                onClick={leaveRoom}
                                className="p-2.5 sm:p-3 bg-rose-50 border border-rose-100 rounded-xl sm:rounded-2xl text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                                title="Quit Game"
                            >
                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                            </button>
                        </div>
                    </div>
                )}

                {room.gameState === 'SELECTING' && (
                    <div className="flex items-center gap-3 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 animate-in zoom-in">
                        <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" />
                        <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">Awaiting Selections</span>
                    </div>
                )}
            </div>

            {/* Custom Mode Upload Area */}
            {isHost && mode === 'custom' && room.gameState === 'LOBBY' && (
                <div className="bg-indigo-50 p-6 border-b border-indigo-100 animate-in slide-in-from-top-4 duration-500">
                    <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex-1">
                            <h3 className="text-lg font-black text-indigo-900 mb-1">Custom Character Mode</h3>
                            <p className="text-sm text-indigo-700/70 font-medium">Upload exactly 16, 20, or 24 pictures of your friends, family, or any characters you want!</p>
                            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-2 flex items-center gap-2">
                                <span className="bg-white px-2 py-0.5 rounded-full border border-indigo-100">Pro Tip</span>
                                Portrait (4:5) or Square photos work best!
                            </p>
                        </div>
                        <label className="relative group cursor-pointer">
                            <input
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                            <div className="bg-white text-indigo-600 px-8 py-4 rounded-2xl font-black shadow-xl shadow-indigo-200/50 border-2 border-dashed border-indigo-200 group-hover:border-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all flex items-center gap-3">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                                <span>{localCharacters.length > 0 ? `${localCharacters.length} Photos Selected` : "Upload Custom Photos"}</span>
                            </div>
                        </label>
                    </div>
                </div>
            )}

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* Main Content */}
                {/* Main Content Area */}
                <div className="flex-1 p-4 sm:p-8 overflow-y-auto pb-32 sm:pb-8">
                    <div className="mb-6 sm:mb-8">
                        <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">
                            Choose Your Character
                        </h3>
                    </div>

                    <div className="grid grid-cols-5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1.5 sm:gap-6">
                        {charactersToDisplay.map(char => (
                            <div
                                key={char.id}
                                onClick={() => !me?.isReady && setSelectedId(char.id)}
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
                                        className="w-full h-full object-cover rounded-md sm:rounded-2xl"
                                    />
                                </div>
                                <div className="p-1 sm:p-3 bg-white rounded-b-lg sm:rounded-b-3xl border-t border-slate-50 text-center">
                                    <p className={`text-[7px] sm:text-sm font-black truncate ${selectedId === char.id ? 'text-indigo-600' : 'text-slate-700'
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
                <div className="hidden lg:flex w-80 p-8 bg-white border-l border-slate-100 flex-col gap-8 overflow-y-auto">
                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Players Connected</h3>
                        <div className="space-y-3">
                            {room.players.map(p => (
                                <div key={p.id} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${p.isReady ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'
                                    }`}>
                                    <div className={`w-3 h-3 rounded-full shadow-sm ${p.isReady ? 'bg-emerald-500 shadow-emerald-200 animate-pulse' : 'bg-slate-300'}`} />
                                    <span className={`font-bold ${p.isReady ? 'text-emerald-700' : 'text-slate-600'}`}>
                                        {p.name} {p.id === socket.id && "(You)"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-auto p-6 bg-slate-900 rounded-[2rem] text-white shadow-2xl relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all" />
                        <h4 className="text-xl font-black mb-2 relative z-10 leading-tight">
                            {me?.isReady ? "Ready to Play!" : "Finalize Selection"}
                        </h4>
                        <p className="text-white/60 text-sm mb-6 relative z-10 leading-relaxed font-medium">
                            {me?.isReady
                                ? "Waiting for opponent..."
                                : "Pick and lock it in."}
                        </p>
                        <button
                            disabled={!selectedId || me?.isReady || room.gameState !== 'SELECTING'}
                            onClick={() => selectCharacter(charactersToDisplay.find(c => c.id === selectedId))}
                            className="w-full py-4 bg-white text-slate-900 rounded-2xl font-bold hover:bg-indigo-50 transition-all disabled:opacity-30 disabled:grayscale active:scale-95 shadow-lg relative z-10"
                        >
                            {me?.isReady ? "Locked In" : "Lock Character"}
                        </button>
                    </div>
                </div>

                {/* Mobile Sticky Footer */}
                <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-xl border-t border-slate-100 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-50 animate-in slide-in-from-bottom-full duration-500">
                    <div className="flex items-center justify-center max-w-lg mx-auto">
                        <button
                            disabled={!selectedId || me?.isReady || room.gameState !== 'SELECTING'}
                            onClick={() => selectCharacter(charactersToDisplay.find(c => c.id === selectedId))}
                            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 w-full py-4 rounded-xl font-black text-white text-sm uppercase tracking-[0.2em] transition-all active:scale-95 shadow-lg shadow-indigo-100"
                        >
                            {me?.isReady ? "LOCKED" : "LOCK PLAYER"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CharacterSelect;
