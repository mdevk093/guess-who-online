import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';

const Chat = () => {
    const { room, sendMessage, socket, sendTypingStatus, opponentTyping } = useGame();
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const chatEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [room?.chat]);

    const handleSend = (e) => {
        e.preventDefault();
        if (input.trim()) {
            sendMessage(input);
            setInput('');
            // Stop typing immediately when sending
            if (isTyping) {
                setIsTyping(false);
                sendTypingStatus(false);
            }
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        }
    };

    const handleInputChange = (e) => {
        setInput(e.target.value);

        if (!isTyping) {
            setIsTyping(true);
            sendTypingStatus(true);
        }

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
            sendTypingStatus(false);
        }, 5000);
    };

    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        };
    }, []);

    return (
        <div className="flex flex-col h-full bg-slate-50/50 rounded-2xl sm:rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
            <div className="p-3 sm:p-4 bg-indigo-600 flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-black text-white/90 uppercase tracking-[0.2em]">Game Chat</span>
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-emerald-400 rounded-full animate-pulse shadow-sm shadow-emerald-400" />
                    <span className="text-[9px] sm:text-[10px] font-black text-white/70 uppercase">Online</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {room?.chat?.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-50 space-y-2">
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <p className="text-xs font-black uppercase tracking-widest">Say hello to start!</p>
                    </div>
                )}
                {room?.chat?.map((msg, i) => {
                    if (msg.type === 'DIVIDER') {
                        return (
                            <div key={i} className="flex items-center gap-4 py-4">
                                <div className="flex-1 h-px bg-slate-200"></div>
                                <span className="text-[9px] font-black text-slate-400 tracking-[0.3em] uppercase whitespace-nowrap">
                                    {msg.text}
                                </span>
                                <div className="flex-1 h-px bg-slate-200"></div>
                            </div>
                        );
                    }
                    const isMe = msg.sender === socket.id;
                    return (
                        <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            <div className={`max-w-[90%] sm:max-w-[85%] px-3 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl text-[13px] sm:text-sm font-medium shadow-sm leading-relaxed ${isMe
                                ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-100'
                                : 'bg-white text-slate-700 rounded-tl-none border border-slate-100 shadow-slate-100'
                                }`}>
                                {msg.text}
                                <div className={`text-[9px] sm:text-[10px] mt-1 opacity-50 font-bold ${isMe ? 'text-white text-right' : 'text-slate-400'}`}>
                                    {msg.timestamp}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {opponentTyping && (
                    <div className="flex flex-col items-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm shadow-slate-100 flex items-center gap-2">
                            <div className="flex gap-1">
                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                            </div>
                            <span className="text-[11px] font-bold text-slate-400">Opponent is typing...</span>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSend} className="p-3 sm:p-4 bg-white border-t border-slate-100 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.02)]">
                <div className="relative group">
                    <input
                        type="text"
                        value={input}
                        onChange={handleInputChange}
                        placeholder="Message..."
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl pl-4 pr-10 py-3 sm:py-4 text-[13px] sm:text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 transition-all placeholder:text-slate-300"
                    />
                    <button
                        type="submit"
                        className="absolute right-1.5 top-1.5 w-8 h-8 sm:w-10 sm:h-10 bg-indigo-600 text-white rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-90"
                    >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 transform rotate-90" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                    </button>
                </div>
            </form>
        </div>
    );
};

export default Chat;
