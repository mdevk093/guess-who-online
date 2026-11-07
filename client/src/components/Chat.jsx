import React, { useState, useEffect, useRef } from 'react';
import { useGame, decodeHtmlEntity } from '../context/GameContext';

const getInitials = (name) => {
    if (!name) return 'OP';
    const clean = decodeHtmlEntity(name).trim();
    return clean.slice(0, 2).toUpperCase();
};

const Chat = ({ isOpen = true }) => {
    const { room, sendMessage, socket, sendTypingStatus, opponentTyping, reportPlayer } = useGame();
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const chatContainerRef = useRef(null);
    const chatEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    const opponent = room?.players?.find(p => p.id !== socket.id);
    const opponentName = opponent?.name ? decodeHtmlEntity(opponent.name) : 'Opponent';
    const opponentInitials = getInitials(opponent?.name);

    const scrollToBottom = React.useCallback(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, []);

    const handleReport = (msg) => {
        if (window.confirm('Report this message for offensive content?')) {
            reportPlayer(msg);
            alert('Report sent. Thank you for helping us keep Guess Who? Online safe!');
        }
    };

    // Auto-scroll to bottom on new messages, typing indicator changes, or when chat drawer opens (FR-CHAT-07)
    useEffect(() => {
        scrollToBottom();
        const rafId = requestAnimationFrame(() => {
            scrollToBottom();
        });
        return () => cancelAnimationFrame(rafId);
    }, [room?.chat?.length, room?.chat, opponentTyping, isOpen, scrollToBottom]);

    const handleSend = (e) => {
        e.preventDefault();
        if (input.trim()) {
            sendMessage(input);
            setInput('');
            if (isTyping) {
                setIsTyping(false);
                sendTypingStatus(false);
            }
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        }
    };

    const handleQuickReply = (text) => {
        sendMessage(text);
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
        <div className="flex flex-col h-full min-h-0 bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden transition-all duration-300">
            {/* Chat Header */}
            <div className="p-4 border-b bg-slate-50 border-slate-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">Deduction Chat</h3>
                        <p className="text-[10px] text-slate-500">Ask Yes / No questions on your turn</p>
                    </div>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-white border-slate-200 text-slate-700">
                    1v1 Match
                </span>
            </div>

            {/* Messages Body */}
            <div ref={chatContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col text-xs">
                {room?.chat?.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 py-8">
                        <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center font-black text-base">
                            ?
                        </div>
                        <p className="text-xs font-bold text-slate-500">Ask a Yes / No question to start deducing!</p>
                    </div>
                )}

                {room?.chat?.map((msg, i) => {
                    if (msg.type === 'DIVIDER') {
                        return (
                            <div key={i} className="flex items-center gap-3 my-3">
                                <div className="flex-1 h-px bg-slate-200"></div>
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border bg-white border-slate-200 text-slate-500 whitespace-nowrap">
                                    {msg.text}
                                </span>
                                <div className="flex-1 h-px bg-slate-200"></div>
                            </div>
                        );
                    }

                    const isMe = msg.sender === socket.id;
                    const formattedTime = msg.timestamp?.replace(/(:\d{2}):\d{2}/, '$1');

                    // Find the most recent non-divider player message before this one
                    let prevPlayerMsg = null;
                    for (let j = i - 1; j >= 0; j--) {
                        if (room.chat[j]?.type !== 'DIVIDER') {
                            prevPlayerMsg = room.chat[j];
                            break;
                        }
                    }
                    const isConsecutive = prevPlayerMsg && prevPlayerMsg.sender === msg.sender;
                    const showSenderHeader = !isConsecutive;

                    if (isMe) {
                        return (
                            <div key={i} className={`flex items-start justify-end gap-2.5 group ${showSenderHeader ? (i === 0 ? '' : 'mt-3.5') : 'mt-1.5'}`}>
                                <div className="space-y-1 max-w-[82%] text-right">
                                    {showSenderHeader && (
                                        <div className="text-[10px] font-bold text-slate-500 flex items-center justify-end gap-1.5">
                                            <span className="text-slate-400 font-normal">{formattedTime}</span> You
                                        </div>
                                    )}
                                    <div
                                        title={formattedTime}
                                        className={`px-3.5 py-2.5 rounded-2xl bg-sky-600 text-white shadow-sm shadow-sky-600/15 leading-relaxed text-left break-words ${showSenderHeader ? 'rounded-tr-sm' : ''}`}
                                    >
                                        {msg.text}
                                    </div>
                                </div>
                                {showSenderHeader ? (
                                    <div className="w-7 h-7 rounded-lg bg-sky-600 text-white font-bold flex items-center justify-center shrink-0 shadow text-[10px]">
                                        ME
                                    </div>
                                ) : (
                                    <div className="w-7 shrink-0" />
                                )}
                            </div>
                        );
                    }

                    return (
                        <div key={i} className={`flex items-start gap-2.5 group ${showSenderHeader ? (i === 0 ? '' : 'mt-3.5') : 'mt-1.5'}`}>
                            {showSenderHeader ? (
                                <div className="w-7 h-7 rounded-lg font-bold flex items-center justify-center shrink-0 border text-[10px] bg-indigo-50 border-indigo-200 text-indigo-700">
                                    {opponentInitials}
                                </div>
                            ) : (
                                <div className="w-7 shrink-0" />
                            )}
                            <div className="space-y-1 max-w-[82%]">
                                {showSenderHeader && (
                                    <div className="text-[10px] font-bold text-slate-600 flex items-center gap-1.5">
                                        <span>{msg.senderName ? decodeHtmlEntity(msg.senderName) : opponentName}</span>
                                        <span className="text-slate-400 font-normal">{formattedTime}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleReport(msg)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-slate-400 hover:text-rose-500"
                                            title="Report message"
                                        >
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4a1 1 0 01-.8 1.6H6a1 1 0 01-1-1V6z" clipRule="evenodd" /></svg>
                                        </button>
                                    </div>
                                )}
                                <div className="flex items-center gap-1.5">
                                    <div
                                        title={formattedTime}
                                        className={`px-3.5 py-2.5 rounded-2xl border bg-slate-100 border-slate-200 text-slate-800 leading-relaxed shadow-sm break-words ${showSenderHeader ? 'rounded-tl-sm' : ''}`}
                                    >
                                        {msg.text}
                                    </div>
                                    {!showSenderHeader && (
                                        <button
                                            type="button"
                                            onClick={() => handleReport(msg)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-slate-400 hover:text-rose-500 shrink-0"
                                            title="Report message"
                                        >
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4a1 1 0 01-.8 1.6H6a1 1 0 01-1-1V6z" clipRule="evenodd" /></svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {opponentTyping && (
                    <div className="flex items-center gap-2 text-xs italic pl-9 mt-3 animate-pulse text-slate-500">
                        <span className="inline-flex gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce"></span>
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce [animation-delay:0.2s]"></span>
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce [animation-delay:0.4s]"></span>
                        </span>
                        {opponentName} is typing...
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>

            {/* Quick Action Deduction Buttons */}
            <div className="px-4 py-2 border-t bg-slate-50/80 border-slate-200 text-slate-600 flex items-center gap-2 overflow-x-auto shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-widest shrink-0 opacity-70">Quick Reply:</span>
                <button
                    type="button"
                    onClick={() => handleQuickReply('👍 Yes')}
                    className="px-3 py-1 rounded-lg border text-xs font-bold transition-all shrink-0 bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700 active:scale-95"
                >
                    👍 Yes
                </button>
                <button
                    type="button"
                    onClick={() => handleQuickReply('👎 No')}
                    className="px-3 py-1 rounded-lg border text-xs font-bold transition-all shrink-0 bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700 active:scale-95"
                >
                    👎 No
                </button>
                <button
                    type="button"
                    onClick={() => handleQuickReply('🤔 Maybe / Unclear')}
                    className="px-3 py-1 rounded-lg border text-xs font-bold transition-all shrink-0 bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700 active:scale-95"
                >
                    🤔 Maybe / Unclear
                </button>
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSend} className="p-3 border-t bg-slate-50 border-slate-200 flex items-center gap-2 shrink-0">
                <input
                    type="text"
                    value={input}
                    onChange={handleInputChange}
                    placeholder="Ask a deduction question..."
                    maxLength={250}
                    className="flex-1 rounded-xl px-4 py-2.5 text-xs focus:outline-none transition-all font-medium border bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
                <button
                    type="submit"
                    className="w-10 h-10 rounded-xl text-white flex items-center justify-center transition-all shadow-md shrink-0 bg-sky-600 hover:bg-sky-500 shadow-sky-600/20 active:scale-95"
                >
                    <svg className="w-4 h-4 transform rotate-90" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path></svg>
                </button>
            </form>
        </div>
    );
};

export default Chat;
