import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { supabase } from '../supabaseClient';
import Auth from './Auth';

const Landing = () => {
    const { createRoom, joinRoom, error, user, stats, continueAsGuest } = useGame();
    const [name, setName] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [isJoining, setIsJoining] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const inviteRoom = params.get('room');
        if (inviteRoom) {
            setRoomCode(inviteRoom.toUpperCase());
            setIsJoining(true);
            // Optionally clear the URL parameter to keep it clean
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    useEffect(() => {
        if (user) {
            setName(user.user_metadata?.username || '');
        }
    }, [user]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    const handlePlayAsGuest = () => {
        if (!name) return;
        continueAsGuest();
        createRoom(name);
    };

    const handleJoinAsGuest = () => {
        if (!name || !roomCode) return;
        continueAsGuest();
        joinRoom(roomCode, name);
    };

    return (
        <div className="min-h-screen bg-slate-50 relative overflow-hidden flex flex-col">

            {/* Background Decorations */}
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
            <div className="absolute top-[20%] right-[-10%] w-96 h-96 bg-rose-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
            <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-amber-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>

            {/* Top Navigation Bar */}
            <nav className="w-full px-6 py-4 flex items-center justify-between z-10 relative">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                        <span className="text-white text-xl font-black italic">?</span>
                    </div>
                    <span className="text-xl font-black text-slate-900 tracking-tight hidden sm:block">Guess Who?</span>
                </div>

                <div className="flex items-center gap-4">
                    {user ? (
                        <div className="flex items-center gap-4 bg-white/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/50 shadow-sm">
                            <div className="flex flex-col items-end mr-2">
                                <span className="text-xs font-black text-slate-800">{user.user_metadata?.username}</span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">Logged In</span>
                            </div>
                            <div className="h-6 w-[1px] bg-slate-200"></div>
                            <div className="flex gap-3 px-2">
                                <div className="flex flex-col items-center">
                                    <span className="text-sm font-black text-emerald-500 leading-none">{stats?.wins || 0}</span>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase">Wins</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-sm font-black text-rose-500 leading-none">{stats?.losses || 0}</span>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase">Losses</span>
                                </div>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="ml-2 p-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors shrink-0"
                                title="Log Out"
                            >
                                <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowAuthModal(true)}
                            className="px-6 py-2.5 bg-white text-indigo-600 font-black text-sm uppercase tracking-widest rounded-xl shadow-sm border border-slate-100 hover:bg-indigo-50 hover:border-indigo-100 transition-all"
                        >
                            Sign In
                        </button>
                    )}
                </div>
            </nav>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col items-center justify-center p-6 z-10 relative">

                <div className="text-center mb-10 max-w-2xl mx-auto">
                    <h1 className="text-5xl sm:text-7xl font-black text-slate-900 tracking-tighter mb-4 drop-shadow-sm">
                        Guess Who? <span className="text-indigo-600 block sm:inline">Online</span>
                    </h1>
                    <p className="text-lg sm:text-xl text-slate-500 font-medium">
                        The classic deduction game, reimagined for the web. Jump right into a quick match or sign in to track your career stats!
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-sm text-center font-medium animate-in fade-in zoom-in max-w-md w-full shadow-sm">
                        {error}
                    </div>
                )}

                <div className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-8 shadow-2xl border border-white/50">
                    <div className="space-y-6">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 mb-2 ml-1 uppercase tracking-widest">Player Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter your display name..."
                                maxLength={20}
                                className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 focus:outline-none text-slate-900 transition-all placeholder:text-slate-300 font-bold shadow-sm text-lg"
                            />
                        </div>

                        {!isJoining ? (
                            <div className="space-y-4 pt-2">
                                <button
                                    onClick={handlePlayAsGuest}
                                    disabled={!name}
                                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 disabled:hover:bg-indigo-600 rounded-2xl font-black text-lg sm:text-xl text-white transition-all transform hover:scale-[1.02] shadow-xl shadow-indigo-200/50 active:scale-95 flex items-center justify-center gap-3"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"></path></svg>
                                    Create Room
                                </button>
                                <button
                                    onClick={() => setIsJoining(true)}
                                    className="w-full py-4 border-2 border-slate-100 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-200 rounded-2xl font-black text-lg transition-all active:scale-95"
                                >
                                    Join an Existing Room
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-bottom-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 mb-2 ml-1 uppercase tracking-widest">Room Code</label>
                                    <input
                                        type="text"
                                        value={roomCode}
                                        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                                        placeholder="EX: A1B2C3"
                                        maxLength={6}
                                        className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-rose-100 focus:border-rose-500 focus:outline-none text-slate-900 transition-all uppercase placeholder:text-slate-300 font-black shadow-sm text-center text-xl tracking-[0.2em]"
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setIsJoining(false)}
                                        className="px-6 py-4 border-2 border-slate-100 bg-slate-50 text-slate-600 rounded-2xl font-black transition-all active:scale-95 hover:bg-slate-100"
                                    >
                                        Back
                                    </button>
                                    <button
                                        onClick={handleJoinAsGuest}
                                        disabled={!name || !roomCode}
                                        className="flex-1 py-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-30 rounded-2xl font-black text-lg text-white shadow-xl shadow-rose-200/50 transition-all active:scale-95"
                                    >
                                        Join with Code
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Auth Modal Overlay */}
            {showAuthModal && !user && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        onClick={() => setShowAuthModal(false)}
                    ></div>
                    <div className="relative z-10 w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
                        <button
                            onClick={() => setShowAuthModal(false)}
                            className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors z-20"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                        <Auth isModal={true} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default Landing;
