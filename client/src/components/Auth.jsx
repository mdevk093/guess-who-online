import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useGame } from '../context/GameContext';

const Auth = ({ onAuthSuccess, isModal = false }) => {
    const { continueAsGuest } = useGame();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [error, setError] = useState(null);

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isSignUp) {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            username: username,
                        },
                    },
                });
                if (error) throw error;

                if (data.session && onAuthSuccess) {
                    onAuthSuccess();
                } else {
                    alert('Check your email for the confirmation link!');
                }
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                if (onAuthSuccess) onAuthSuccess();
            }
        } catch (error) {
            setError(error.description || error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`flex flex-col items-center justify-center ${isModal ? 'p-0 w-full' : 'min-h-screen bg-[#f8fafc] p-4'}`}>
            <div className={`w-full bg-white rounded-3xl p-8 ${isModal ? '' : 'max-w-md shadow-xl border border-slate-200'}`}>
                <div className="flex flex-col items-center mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/25 mb-4">
                        <span className="text-white text-2xl font-black">?</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Guess Who?</h1>
                    <p className="text-slate-500 font-medium text-sm mt-1">{isSignUp ? 'Create your account' : 'Welcome back'}</p>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                    {isSignUp && (
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-slate-900 focus:outline-none focus:ring-4 focus:ring-sky-100 focus:border-sky-500 font-bold transition-all"
                                placeholder="Enter username"
                                required
                            />
                        </div>
                    )}
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-slate-900 focus:outline-none focus:ring-4 focus:ring-sky-100 focus:border-sky-500 font-bold transition-all"
                            placeholder="Enter email"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-slate-900 focus:outline-none focus:ring-4 focus:ring-sky-100 focus:border-sky-500 font-bold transition-all"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    {error && (
                        <div className="bg-rose-50 text-rose-600 p-4 rounded-xl text-xs font-bold border border-rose-200 animate-in fade-in zoom-in">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-sky-600 hover:bg-sky-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-sky-600/25 transition-all transform active:scale-95 disabled:opacity-50"
                    >
                        {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Log In'}
                    </button>
                </form>

                <div className="mt-8 flex flex-col items-center gap-4">
                    <button
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-sm font-bold text-sky-600 hover:text-sky-700"
                    >
                        {isSignUp ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
                    </button>

                    {!isModal && (
                        <>
                            <div className="w-full flex items-center gap-4 py-2">
                                <div className="flex-1 h-[1px] bg-slate-200" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">OR</span>
                                <div className="flex-1 h-[1px] bg-slate-200" />
                            </div>

                            <button
                                onClick={continueAsGuest}
                                className="text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
                            >
                                Continue as Guest →
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Auth;
