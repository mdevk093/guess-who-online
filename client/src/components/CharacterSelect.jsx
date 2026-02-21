import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';

const CharacterSelect = () => {
    const { room, playerName, startGame, selectCharacter, socket, leaveRoom } = useGame();
    const [mode, setMode] = useState('default'); // 'default', 'custom', or one of the preset keys
    const [presets, setPresets] = useState({});
    const [localCharacters, setLocalCharacters] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const isHost = room.players.find(p => p.id === socket.id)?.isHost;

    useEffect(() => {
        // Fetch presets
        fetch('http://localhost:3001/presets')
            .then(res => res.json())
            .then(data => setPresets(data));
    }, []);

    useEffect(() => {
        if (mode === 'default') {
            fetch('http://localhost:3001/defaultCharacters.json')
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
            startGame(localCharacters);
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
            <div className="flex items-center justify-between p-6 bg-white border-b border-slate-100 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
                        <span className="text-white text-xl font-black italic">?</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Character Selection</h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">Room Code: <span className="text-indigo-600 font-black">{room.id}</span></p>
                    </div>
                </div>

                {isHost && room.gameState === 'LOBBY' && (
                    <div className="flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Select Theme</span>
                            <select
                                value={mode}
                                onChange={(e) => setMode(e.target.value)}
                                className="bg-slate-50 text-slate-700 px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-100 font-bold transition-all"
                            >
                                <option value="default">Default Characters</option>
                                <option value="marvel_dc">Marvel & DC</option>
                                <option value="youtubers">YouTubers (2010-2018)</option>
                                <option value="fruits_veg">Fruits & Vegetables</option>
                                <option value="anime">Anime Characters</option>
                                <option value="custom">Upload Custom</option>
                            </select>
                        </div>

                        {mode === 'custom' && (
                            <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-dashed border-slate-300">
                                <label className="cursor-pointer bg-white px-4 py-2 rounded-xl text-sm font-bold border border-slate-200 hover:bg-white shadow-sm transition-all active:scale-95">
                                    Upload (16-24)
                                    <input type="file" multiple accept="image/*" onChange={handleFileUpload} className="hidden" />
                                </label>
                            </div>
                        )}

                        <button
                            onClick={handleStart}
                            disabled={room.players.length < 2 || localCharacters.length === 0}
                            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 px-8 py-3 rounded-2xl font-black text-white transition-all transform hover:scale-[1.02] shadow-xl shadow-indigo-200 active:scale-95"
                        >
                            Start Match {room.players.length < 2 ? "(Waiting...)" : localCharacters.length === 0 ? "(Loading...)" : ""}
                        </button>
                        <button
                            onClick={leaveRoom}
                            className="p-3 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                            title="Quit Game"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                        </button>
                    </div>
                )}

                {room.gameState === 'SELECTING' && (
                    <div className="flex items-center gap-3 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 animate-in zoom-in">
                        <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" />
                        <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">Awaiting Selections</span>
                    </div>
                )}
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Main Content */}
                <div className="flex-1 p-8 overflow-y-auto">
                    <div className="mb-8">
                        <h3 className="text-2xl font-black text-slate-900 mb-2">
                            {room.gameState === 'SELECTING' ? "Choose Your Secret Character" : "Waiting for host to choose theme"}
                        </h3>
                        <p className="text-slate-400 font-medium">This is the character your opponent needs to guess!</p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-6">
                        {charactersToDisplay.map(char => (
                            <div
                                key={char.id}
                                onClick={() => !me?.isReady && setSelectedId(char.id)}
                                className={`group relative bg-white rounded-3xl cursor-pointer transition-all duration-300 transform ${!me?.isReady && 'hover:-translate-y-2'
                                    } border-2 ${selectedId === char.id
                                        ? 'border-indigo-600 ring-4 ring-indigo-50 shadow-2xl scale-[1.02]'
                                        : 'border-white hover:border-indigo-100 shadow-lg shadow-slate-200/50'
                                    } ${me?.isReady ? 'opacity-50 grayscale pointer-events-none' : ''}`}
                            >
                                <div className="aspect-[4/5] p-3 overflow-hidden rounded-t-3xl text-center flex items-center justify-center">
                                    <img
                                        src={char.image}
                                        alt={char.name}
                                        className={`w-full h-full object-cover rounded-2xl transition-all duration-300 ${selectedId === char.id ? 'scale-110' : 'group-hover:scale-105'
                                            }`}
                                    />
                                </div>
                                <div className={`p-4 text-center border-t border-slate-50 transition-colors ${selectedId === char.id ? 'bg-indigo-600' : 'bg-white'
                                    }`}>
                                    <p className={`text-sm font-black truncate ${selectedId === char.id ? 'text-white' : 'text-slate-700'
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
                <div className="w-80 p-8 bg-white border-l border-slate-100 flex flex-col gap-8">
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
                                    {p.isReady && (
                                        <span className="ml-auto bg-emerald-500 text-white p-1 rounded-full">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-auto p-6 bg-slate-900 rounded-[2rem] text-white shadow-2xl relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all" />
                        <h4 className="text-xl font-black mb-2 relative z-10">
                            {me?.isReady ? "Ready to Play!" : "Finalize Selection"}
                        </h4>
                        <p className="text-white/60 text-sm mb-6 relative z-10 leading-relaxed font-medium">
                            {me?.isReady
                                ? "Waiting for the other player to pick their character..."
                                : "Pick character and lock it in to start the battle."}
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
            </div>
        </div>
    );
};

export default CharacterSelect;
