import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useGame } from '../context/GameContext';

const Auth = ({ onAuthSuccess }) => {
    const { continueAsGuest } = useGame();
    const [loading, setLoading] = useState(false);
    // ... no changes to other states
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
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
            <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-slate-100">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 mb-4">
                        <span className="text-white text-2xl font-black italic">?</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Guess Who?</h1>
                    <p className="text-slate-500 font-medium">{isSignUp ? 'Create your account' : 'Welcome back'}</p>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                    {isSignUp && (
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1 ml-1">Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-100 font-bold transition-all"
                                placeholder="Enter username"
                                required
                            />
                        </div>
                    )}
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1 ml-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-100 font-bold transition-all"
                            placeholder="Enter email"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1 ml-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-100 font-bold transition-all"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    {error && (
                        <div className="bg-rose-50 text-rose-600 p-4 rounded-xl text-xs font-bold border border-rose-100 animate-in fade-in zoom-in">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-100 transition-all transform active:scale-95 disabled:opacity-50"
                    >
                        {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Log In'}
                    </button>
                </form>

                <div className="mt-8 flex flex-col items-center gap-4">
                    <button
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-sm font-bold text-indigo-600 hover:text-indigo-700"
                    >
                        {isSignUp ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
                    </button>

                    <div className="w-full flex items-center gap-4 py-2">
                        <div className="flex-1 h-[1px] bg-slate-100" />
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">OR</span>
                        <div className="flex-1 h-[1px] bg-slate-100" />
                    </div>

                    <button
                        onClick={continueAsGuest}
                        className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        Continue as Guest →
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Auth;
