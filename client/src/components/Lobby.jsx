import React, { useState } from 'react';
import { useGame } from '../context/GameContext';

const Lobby = () => {
    const { createRoom, joinRoom, error } = useGame();
    const [name, setName] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [isJoining, setIsJoining] = useState(false);

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
            <div className="w-full max-w-md bg-white rounded-[2.5rem] p-8 sm:p-10 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] border border-slate-100">
                <div className="flex justify-center mb-8">
                    <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-lg shadow-indigo-200">
                        <span className="text-white text-3xl font-black italic">?</span>
                    </div>
                </div>

                <h1 className="text-3xl font-black text-center mb-2 text-slate-900 tracking-tight">
                    Guess Who?
                </h1>
                <p className="text-center text-slate-400 mb-10 font-medium">Online Multiplayer Edition</p>

                {error && (
                    <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-sm text-center font-medium animate-in fade-in zoom-in">
                        {error}
                    </div>
                )}

                <div className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-2 ml-1 uppercase tracking-widest">Your Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Type your name..."
                            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 focus:outline-none text-slate-900 transition-all placeholder:text-slate-300 font-medium"
                        />
                    </div>

                    {!isJoining ? (
                        <div className="space-y-4">
                            <button
                                onClick={() => name && createRoom(name)}
                                disabled={!name}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 disabled:hover:bg-indigo-600 rounded-2xl font-bold text-lg text-white transition-all transform hover:scale-[1.02] shadow-xl shadow-indigo-200 active:scale-95"
                            >
                                Create Room
                            </button>
                            <button
                                onClick={() => setIsJoining(true)}
                                className="w-full py-4 border-2 border-slate-100 text-slate-600 hover:bg-slate-50 rounded-2xl font-bold text-lg transition-all active:scale-95"
                            >
                                Join with Code
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2 ml-1 uppercase tracking-widest">Room Code</label>
                                <input
                                    type="text"
                                    value={roomCode}
                                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                                    placeholder="EX: A1B2C3"
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-rose-100 focus:border-rose-500 focus:outline-none text-slate-900 transition-all uppercase placeholder:text-slate-300 font-medium"
                                />
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setIsJoining(false)}
                                    className="flex-1 py-4 border-2 border-slate-100 text-slate-600 rounded-2xl font-bold transition-all active:scale-95"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={() => name && roomCode && joinRoom(roomCode, name)}
                                    disabled={!name || !roomCode}
                                    className="flex-[2] py-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-30 rounded-2xl font-bold text-white shadow-xl shadow-rose-200 transition-all active:scale-95"
                                >
                                    Join Room
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Lobby;
