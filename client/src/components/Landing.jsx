import React, { useState, useEffect } from 'react';
import { useGame, decodeHtmlEntity } from '../context/GameContext';
import { supabase } from '../supabaseClient';
import Auth from './Auth';

const Landing = () => {
    const { createRoom, joinRoom, publicRooms, fetchPublicRooms, error, user, stats, continueAsGuest, playerName, setPlayerName } = useGame();
    const [name, setName] = useState(() => {
        if (playerName) return playerName;
        try {
            return sessionStorage.getItem('player_name') || localStorage.getItem('player_name') || '';
        } catch {
            return '';
        }
    });
    const [roomCode, setRoomCode] = useState('');
    const [isJoining, setIsJoining] = useState(false);
    const [isViewingLobbies, setIsViewingLobbies] = useState(false);
    const [hideFullLobbies, setHideFullLobbies] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);

    useEffect(() => {
        fetchPublicRooms();
    }, [fetchPublicRooms]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const inviteRoom = params.get('room');
        if (inviteRoom) {
            setRoomCode(inviteRoom.toUpperCase());
            setIsJoining(true);
        }
    }, []);

    useEffect(() => {
        if (user?.user_metadata?.username && !name) {
            const username = user.user_metadata.username;
            setName(username);
            setPlayerName(username);
            try {
                sessionStorage.setItem('player_name', username);
                localStorage.setItem('player_name', username);
            } catch {
                // ignore storage errors
            }
        }
    }, [user, name, setPlayerName]);

    const handleNameChange = (e) => {
        const val = e.target.value;
        setName(val);
        setPlayerName(val);
        try {
            sessionStorage.setItem('player_name', val);
            localStorage.setItem('player_name', val);
        } catch {
            // ignore storage errors
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    const handlePlayAsGuest = () => {
        if (!name) return;
        continueAsGuest();
        createRoom(name, true);
    };

    const handleJoinAsGuest = () => {
        if (!name || !roomCode) return;
        continueAsGuest();
        joinRoom(roomCode, name);
    };

    const handleJoinPublicRoom = (targetRoomId) => {
        if (!name) return;
        continueAsGuest();
        joinRoom(targetRoomId, name);
    };

    const displayedPublicRooms = hideFullLobbies
        ? publicRooms.filter(r => !r.isFull)
        : publicRooms;

    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-800 relative overflow-hidden flex flex-col">

            {/* Subtle Clean Studio Ambient Glow */}
            <div className="absolute top-[-10%] left-[-5%] w-96 h-96 bg-sky-400/15 rounded-full mix-blend-multiply filter blur-3xl opacity-80 pointer-events-none"></div>
            <div className="absolute top-[20%] right-[-5%] w-96 h-96 bg-blue-400/15 rounded-full mix-blend-multiply filter blur-3xl opacity-80 pointer-events-none"></div>
            <div className="absolute bottom-[-15%] left-[25%] w-96 h-96 bg-indigo-400/10 rounded-full mix-blend-multiply filter blur-3xl opacity-70 pointer-events-none"></div>

            {/* Top Navigation Bar */}
            <nav className="w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between z-10 relative border-b border-slate-200/80">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/25">
                        <span className="text-white text-xl font-black">?</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <span className="text-xl font-black text-slate-900 tracking-tight">Guess Who?</span>
                        <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-700">
                            1v1 Deduction
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {user ? (
                        <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="flex flex-col items-end mr-1">
                                <span className="text-xs font-black text-slate-900">{user.user_metadata?.username}</span>
                                <span className="text-[9px] font-bold text-sky-600 uppercase tracking-widest leading-none mt-0.5">Logged In</span>
                            </div>
                            <div className="h-6 w-[1px] bg-slate-200"></div>
                            <div className="flex gap-3 px-1">
                                <div className="flex flex-col items-center">
                                    <span className="text-sm font-black text-emerald-600 leading-none">{stats?.wins || 0}</span>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">Wins</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-sm font-black text-rose-500 leading-none">{stats?.losses || 0}</span>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">Losses</span>
                                </div>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="ml-1 p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors shrink-0"
                                title="Log Out"
                            >
                                <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowAuthModal(true)}
                            className="px-5 py-2.5 bg-white text-sky-700 font-black text-xs uppercase tracking-widest rounded-xl shadow-sm border border-slate-200 hover:bg-sky-50 hover:border-sky-300 transition-all"
                        >
                            Sign In
                        </button>
                    )}
                </div>
            </nav>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col items-center justify-center p-6 z-10 relative">

                <div className="text-center mb-8 max-w-2xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-xs font-bold mb-4">
                        <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span>
                        Real-Time Head-to-Head Multiplayer
                    </div>
                    <h1 className="text-5xl sm:text-6xl font-black text-slate-900 tracking-tight mb-3">
                        Guess Who? <span className="text-sky-600">Online</span>
                    </h1>
                    <p className="text-base sm:text-lg text-slate-500 font-medium max-w-xl mx-auto">
                        Ask smart Yes or No questions, eliminate suspects on your board, and deduce your opponent&apos;s secret character first.
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-sm text-center font-bold animate-in fade-in zoom-in max-w-md w-full shadow-sm">
                        {decodeHtmlEntity(error)}
                    </div>
                )}

                <div className="w-full max-w-md bg-white rounded-3xl p-7 sm:p-8 shadow-xl border border-slate-200">
                    <div className="space-y-5">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 mb-2 ml-1 uppercase tracking-widest">Player Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={handleNameChange}
                                placeholder="Enter your display name..."
                                maxLength={20}
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-sky-100 focus:border-sky-500 focus:outline-none text-slate-900 transition-all placeholder:text-slate-400 font-bold text-base"
                            />
                        </div>

                        {!isJoining && !isViewingLobbies ? (
                            <div className="space-y-3 pt-1">
                                <button
                                    onClick={handlePlayAsGuest}
                                    disabled={!name}
                                    className="w-full py-4 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 disabled:opacity-40 rounded-2xl font-black text-base sm:text-lg text-white transition-all transform hover:scale-[1.01] shadow-lg shadow-sky-600/25 active:scale-95 flex items-center justify-center gap-2.5"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"></path></svg>
                                    Create Match Lobby
                                </button>
                                <button
                                    onClick={() => {
                                        fetchPublicRooms();
                                        setIsViewingLobbies(true);
                                    }}
                                    className="w-full py-3.5 border border-sky-200 bg-sky-50/70 text-sky-700 hover:bg-sky-100/80 hover:border-sky-300 rounded-2xl font-black text-base transition-all active:scale-95 flex items-center justify-center gap-2.5"
                                >
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    Browse Public Lobbies
                                    {publicRooms.filter(r => !r.isFull).length > 0 && (
                                        <span className="px-2 py-0.5 bg-sky-600 text-white rounded-full text-xs font-black">
                                            {publicRooms.filter(r => !r.isFull).length}
                                        </span>
                                    )}
                                </button>
                                <button
                                    onClick={() => setIsJoining(true)}
                                    className="w-full py-3.5 border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-300 rounded-2xl font-black text-base transition-all active:scale-95"
                                >
                                    Join with Room Code
                                </button>
                            </div>
                        ) : isViewingLobbies ? (
                            <div className="space-y-4 pt-1 animate-in fade-in slide-in-from-bottom-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                        <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">
                                            Public Lobbies ({displayedPublicRooms.length})
                                        </h3>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setHideFullLobbies(!hideFullLobbies)}
                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all active:scale-95 ${hideFullLobbies
                                            ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                            }`}
                                    >
                                        {hideFullLobbies ? '✓ Open Only' : 'Hide Full'}
                                    </button>
                                </div>

                                {displayedPublicRooms.length === 0 ? (
                                    <div className="py-8 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center">
                                        <p className="text-xs font-bold text-slate-400">
                                            {hideFullLobbies && publicRooms.length > 0
                                                ? 'No open lobbies right now. Toggle filter to see full rooms.'
                                                : 'No public lobbies active right now.'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                                        {displayedPublicRooms.map((pubRoom) => {
                                            const isJoinable = !pubRoom.isFull;
                                            return (
                                                <div
                                                    key={pubRoom.roomId}
                                                    className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${isJoinable
                                                        ? 'bg-white border-slate-200 shadow-sm hover:border-sky-300'
                                                        : 'bg-slate-50 border-slate-200 opacity-60'
                                                        }`}
                                                >
                                                    <div className="flex flex-col min-w-0 pr-3">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-black text-slate-900 truncate">
                                                                {decodeHtmlEntity(pubRoom.hostName)}&apos;s Lobby
                                                            </span>
                                                            <span className="text-[10px] font-black text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                                                {pubRoom.roomId}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${isJoinable ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                                {pubRoom.playerCount}/{pubRoom.maxPlayers || 2} Players
                                                            </span>
                                                            <span className="text-slate-300">•</span>
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                                {pubRoom.gameState === 'LOBBY'
                                                                    ? (isJoinable ? 'Waiting for Opponent' : 'Full Lobby')
                                                                    : 'In Progress'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        disabled={!isJoinable || !name}
                                                        onClick={() => handleJoinPublicRoom(pubRoom.roomId)}
                                                        title={!name ? 'Enter your Player Name above to join' : ''}
                                                        className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest shrink-0 transition-all ${isJoinable
                                                            ? 'bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white shadow-sm shadow-sky-600/20 active:scale-95'
                                                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                                            }`}
                                                    >
                                                        {isJoinable ? 'Join' : 'Full'}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {!name && displayedPublicRooms.some(r => !r.isFull) && (
                                    <p className="text-[11px] font-bold text-amber-600 text-center">
                                        ↑ Enter your Player Name above to join an open lobby
                                    </p>
                                )}

                                <button
                                    type="button"
                                    onClick={() => setIsViewingLobbies(false)}
                                    className="w-full py-3.5 border border-slate-200 bg-slate-50 text-slate-600 rounded-2xl font-black transition-all active:scale-95 hover:bg-slate-100"
                                >
                                    Back
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4 pt-1 animate-in fade-in slide-in-from-bottom-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 mb-2 ml-1 uppercase tracking-widest">Room Code</label>
                                    <input
                                        type="text"
                                        value={roomCode}
                                        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                                        placeholder="EX: X9K2P4"
                                        maxLength={6}
                                        className="w-full px-6 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-sky-100 focus:border-sky-500 focus:outline-none text-slate-900 transition-all uppercase placeholder:text-slate-300 font-black text-center text-xl tracking-[0.2em]"
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setIsJoining(false)}
                                        className="px-6 py-3.5 border border-slate-200 bg-slate-50 text-slate-600 rounded-2xl font-black transition-all active:scale-95 hover:bg-slate-100"
                                    >
                                        Back
                                    </button>
                                    <button
                                        onClick={handleJoinAsGuest}
                                        disabled={!name || !roomCode}
                                        className="flex-1 py-3.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 rounded-2xl font-black text-base text-white shadow-lg shadow-sky-600/20 transition-all active:scale-95"
                                    >
                                        Join Match
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
                        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                        onClick={() => setShowAuthModal(false)}
                    ></div>
                    <div className="relative z-10 w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in duration-200">
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
