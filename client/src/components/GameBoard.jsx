import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import Chat from './Chat';

const GameBoard = () => {
    const { room, socket, makeGuess, restartGame, endTurn, leaveRoom } = useGame();
    const [eliminatedIds, setEliminatedIds] = useState([]);
    const [guessModalOpen, setGuessModalOpen] = useState(false);
    const [mobileTab, setMobileTab] = useState('board'); // 'board' or 'chat'
    const [unreadMessages, setUnreadMessages] = useState(false);

    const me = room.players.find(p => p.id === socket.id);
    const myTurn = room.players[room.turn].id === socket.id;
    const opponent = room.players.find(p => p.id !== socket.id);

    // Track unread messages on mobile
    React.useEffect(() => {
        if (room?.chat?.length > 0) {
            const lastMsg = room.chat[room.chat.length - 1];
            // If message is from opponent and we are NOT on chat tab
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

    // Determine result from room state
    const isGameOver = room.gameState === 'GAME_OVER';
    const won = isGameOver && room.result.winnerId === socket.id;
    const correctCharacter = isGameOver ? room.result.correctCharacter : null;

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-slate-50 text-slate-900">
            {/* Header */}
            <div className="h-16 sm:h-20 flex items-center justify-between px-4 sm:px-8 bg-white border-b border-slate-100 shadow-sm relative z-10">
                <div className="flex items-center gap-3 sm:gap-6">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-600 rounded-lg sm:rounded-[0.85rem] flex items-center justify-center shadow-lg shadow-indigo-100">
                            <span className="text-white text-lg sm:text-xl font-black italic">?</span>
                        </div>
                        <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight hidden sm:block">Guess Who?</h1>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-4 sm:border-l sm:border-slate-100 sm:pl-6">
                        <div className={`px-3 sm:px-4 py-1.5 rounded-full text-[8px] sm:text-[10px] font-black tracking-widest transition-all ${myTurn
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                            : 'bg-slate-100 text-slate-400'
                            }`}>
                            {myTurn ? "YOUR TURN" : `${opponent?.name?.toUpperCase()}'S TURN`}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-4">
                    <button
                        onClick={() => setGuessModalOpen(true)}
                        disabled={!myTurn || isGameOver}
                        className="bg-rose-600 hover:bg-rose-700 disabled:opacity-30 px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-sm text-white shadow-xl shadow-rose-100 transition-all active:scale-95"
                    >
                        Guess
                    </button>
                    <button
                        onClick={endTurn}
                        disabled={!myTurn || isGameOver}
                        className="bg-slate-900 hover:bg-slate-800 disabled:opacity-30 px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-sm text-white shadow-xl shadow-slate-200 transition-all active:scale-95"
                    >
                        End
                    </button>
                    <button
                        onClick={leaveRoom}
                        className="p-2 sm:p-2.5 bg-rose-50 border border-rose-100 rounded-xl sm:rounded-2xl text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                        title="Quit Game"
                    >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
                {/* Board */}
                <div className={`flex-1 overflow-y-auto p-3 sm:p-8 bg-slate-50/50 transition-all duration-300 ${mobileTab === 'chat' ? 'hidden sm:block' : 'block'}`}>
                    <div className="grid grid-cols-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-1.5 sm:gap-6 pb-20">
                        {room.characters.map((char) => (
                            <div
                                key={char.id}
                                onClick={() => toggleEliminate(char.id)}
                                className={`group relative bg-white rounded-lg sm:rounded-3xl cursor-pointer transition-all duration-300 transform overflow-hidden border border-slate-900/10 ${eliminatedIds.includes(char.id)
                                    ? 'opacity-30 grayscale scale-95 brightness-75'
                                    : 'hover:-translate-y-1 shadow-xl shadow-slate-200/50'
                                    }`}
                            >
                                <div className="aspect-[4/5] p-0.5 sm:p-3 overflow-hidden rounded-t-lg sm:rounded-t-3xl text-center flex items-center justify-center">
                                    <img
                                        src={char.image}
                                        alt={char.name}
                                        className="w-full h-full object-cover rounded-md sm:rounded-2xl"
                                    />
                                </div>
                                <div className="p-1 sm:p-3 bg-white rounded-b-lg sm:rounded-b-3xl border-t border-slate-50 text-center">
                                    <p className="text-[7px] sm:text-sm font-black text-slate-700 truncate">{char.name}</p>
                                </div>

                                {eliminatedIds.includes(char.id) && (
                                    <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                                        <div className="w-full h-1 bg-rose-600/60 rotate-45 absolute" />
                                        <div className="w-full h-1 bg-rose-600/60 -rotate-45 absolute" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Sidebar */}
                <div className={`w-full lg:w-96 flex flex-col gap-4 sm:gap-6 p-4 sm:p-8 overflow-y-auto bg-white border-l border-slate-100 transition-all duration-300 ${mobileTab === 'board' ? 'hidden sm:flex' : 'flex'}`}>
                    {/* Your Character Card */}
                    <div className="bg-slate-50/50 rounded-3xl sm:rounded-[2.5rem] p-4 sm:p-6 border border-slate-100 shadow-sm flex items-center gap-4 sm:gap-6">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl overflow-hidden border-4 border-white shadow-xl ring-1 ring-slate-900/10">
                            <img src={me?.selectedCharacter?.image} alt="You" className="w-full h-full object-cover" />
                        </div>
                        <div>
                            <span className="text-[8px] sm:text-[10px] font-black text-indigo-500 uppercase tracking-widest block mb-0.5 sm:mb-1">Target</span>
                            <h2 className="text-lg sm:text-2xl font-black text-slate-800 tracking-tight leading-tight">{me?.selectedCharacter?.name}</h2>
                        </div>
                    </div>

                    {/* Chat Section */}
                    <div className="flex-1 min-h-[300px] sm:min-h-[400px]">
                        <Chat />
                    </div>

                    {/* Suspects Counter */}
                    <div className="p-4 sm:p-6 bg-slate-900 rounded-2xl sm:rounded-[2rem] text-white flex items-center justify-between shadow-2xl">
                        <span className="font-bold text-white/50 uppercase text-[10px] sm:text-xs tracking-widest">Suspects</span>
                        <span className="text-2xl sm:text-4xl font-black tracking-tighter">{room.characters.length - eliminatedIds.length}</span>
                    </div>
                </div>

                {/* Mobile Navigation Bar */}
                <div className="sm:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-100 px-6 flex items-center justify-around z-50">
                    <button
                        onClick={() => setMobileTab('board')}
                        className={`flex flex-col items-center gap-1 transition-all ${mobileTab === 'board' ? 'text-indigo-600' : 'text-slate-400'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                        <span className="text-[10px] font-black uppercase tracking-widest">Board</span>
                    </button>
                    <button
                        onClick={() => setMobileTab('chat')}
                        className={`flex flex-col items-center gap-1 transition-all ${mobileTab === 'chat' ? 'text-indigo-600' : 'text-slate-400'}`}
                    >
                        <div className="relative">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            {unreadMessages && (
                                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white animate-pulse" />
                            )}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest">Chat</span>
                    </button>
                </div>
            </div>

            {/* Modals same but light theme... */}
            {guessModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-6">
                    <div className="bg-white max-w-2xl w-full rounded-[3rem] p-10 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
                        <h3 className="text-2xl font-black mb-6 text-slate-900">Make Your Guess</h3>
                        <div className="flex-1 overflow-y-auto grid grid-cols-5 gap-1.5 pr-1">
                            {room.characters.map(char => (
                                <button
                                    key={char.id}
                                    onClick={() => handleGuess(char)}
                                    className="group relative bg-slate-50 rounded-lg p-0.5 border border-slate-900/10 hover:border-indigo-600 transition-all transform hover:scale-105"
                                >
                                    <div className="aspect-square rounded-md overflow-hidden mb-0.5">
                                        <img src={char.image} alt={char.name} className="w-full h-full object-cover" />
                                    </div>
                                    <p className="text-[7px] font-bold text-slate-600 truncate">{char.name}</p>
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setGuessModalOpen(false)}
                            className="mt-8 w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black transition-all"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Result Backdrop */}
            {isGameOver && (
                <div className="fixed inset-0 bg-white/95 backdrop-blur-xl flex flex-col items-center justify-center z-[200] text-center p-8 animate-in fade-in zoom-in duration-500">
                    <div className="mb-12 relative">
                        <div className={`w-32 h-32 rounded-[3rem] mx-auto flex items-center justify-center shadow-2xl mb-8 ${won ? 'bg-emerald-500 shadow-emerald-200' : 'bg-rose-500 shadow-rose-200'
                            }`}>
                            <span className="text-white text-5xl font-black">{won ? '✓' : '✗'}</span>
                        </div>
                        <h2 className={`text-7xl font-black mb-4 tracking-tighter ${won ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {won ? 'VICTORY!' : 'GAME OVER'}
                        </h2>
                        <p className="text-xl text-slate-400 font-medium">
                            The secret character was <span className="text-slate-900 font-black tracking-tight underline decoration-indigo-500 decoration-4 underline-offset-4">{correctCharacter?.name}</span>
                        </p>
                    </div>

                    <div className="flex flex-col gap-4 w-full max-w-xs">
                        <button
                            onClick={restartGame}
                            className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 rounded-[2rem] font-black text-xl text-white shadow-2xl shadow-indigo-200 transition-all transform hover:scale-105 active:scale-95"
                        >
                            Play Again
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GameBoard;
