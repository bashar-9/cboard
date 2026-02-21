'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBoardStore } from '@/store/useBoardStore';
import { Loader2, ArrowRight, ShieldCheck, Zap, Cloud } from 'lucide-react';
import { toast } from 'sonner';

// Google SVG Icon for the OAuth button
const GoogleIcon = () => (
    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
        <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
        />
        <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
        />
        <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
        />
        <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
        />
    </svg>
);

export default function AuthPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);

    const router = useRouter();
    const setUser = useBoardStore(state => state.setUser);
    const setIsPrivateMode = useBoardStore(state => state.setIsPrivateMode);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const supabase = createClient();

        try {
            if (isSignUp) {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                if (data.user) {
                    setUser(data.user);
                    setIsPrivateMode(true);
                    toast.success("Account created successfully!");
                    router.push('/');
                } else {
                    toast.success("Check your email for the confirmation link.");
                }
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                if (data.user) {
                    setUser(data.user);
                    setIsPrivateMode(true);
                    toast.success("Signed in successfully!");
                    router.push('/');
                }
            }
        } catch (err: any) {
            toast.error(err.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleAuth = async () => {
        setIsGoogleLoading(true);
        const supabase = createClient();
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                }
            });
            if (error) throw error;
        } catch (err: any) {
            toast.error(err.message || 'Google authentication failed');
            setIsGoogleLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-white dark:bg-slate-950 font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900/40">
            {/* Left Column: Form */}
            <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-20 xl:px-24">
                <div className="mx-auto w-full max-w-[400px]">
                    {/* Logo/Brand */}
                    <div className="flex items-center gap-3 mb-10 cursor-pointer" onClick={() => router.push('/')}>
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 dark:from-white dark:to-slate-200 text-white dark:text-slate-900 flex items-center justify-center font-bold text-xl shadow-lg border border-slate-700 dark:border-white/20">
                            C
                        </div>
                        <span className="font-bold tracking-tight text-2xl bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                            Board
                        </span>
                    </div>

                    <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
                        {isSignUp ? 'Create an account' : 'Welcome back'}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                        {isSignUp
                            ? 'Enter your details below to activate your private cloud clipboard.'
                            : 'Sign in to access your synchronized devices.'}
                    </p>

                    <div className="space-y-6">
                        {/* OAuth Button */}
                        <Button
                            variant="outline"
                            type="button"
                            className="w-full h-12 rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 font-medium transition-all"
                            onClick={handleGoogleAuth}
                            disabled={isGoogleLoading || loading}
                        >
                            {isGoogleLoading ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <GoogleIcon />
                            )}
                            Continue with Google
                        </Button>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-slate-200 dark:border-slate-800" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-white dark:bg-slate-950 px-3 flex text-slate-400 font-medium">Or continue with email</span>
                            </div>
                        </div>

                        {/* Standard Form */}
                        <form onSubmit={handleAuth} className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-slate-700 dark:text-slate-300 font-medium">Email address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="name@example.com"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="h-12 rounded-xl border-slate-200 dark:border-slate-800 bg-transparent focus-visible:ring-indigo-500 dark:focus-visible:ring-indigo-400"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-slate-700 dark:text-slate-300 font-medium">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="h-12 rounded-xl border-slate-200 dark:border-slate-800 bg-transparent focus-visible:ring-indigo-500 dark:focus-visible:ring-indigo-400"
                                />
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-md shadow-indigo-600/20 transition-all group"
                                disabled={loading || isGoogleLoading}
                            >
                                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                {!loading && (isSignUp ? 'Sign Up' : 'Sign In')}
                                {!loading && <ArrowRight className="w-4 h-4 ml-2 opacity-70 group-hover:translate-x-1 transition-transform" />}
                            </Button>
                        </form>

                        <div className="text-center text-sm text-slate-500 mt-6">
                            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                            <button
                                type="button"
                                onClick={() => setIsSignUp(!isSignUp)}
                                className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors"
                            >
                                {isSignUp ? 'Sign in instead' : 'Sign up for free'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column: Visual Context */}
            <div className="hidden lg:flex w-1/2 flex-col justify-center bg-slate-50 dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800/50 p-12 relative overflow-hidden">
                {/* Background Decor */}
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 dark:bg-indigo-500/10 blur-[100px] rounded-full mix-blend-multiply dark:mix-blend-lighten pointer-events-none" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 dark:bg-purple-500/10 blur-[100px] rounded-full mix-blend-multiply dark:mix-blend-lighten pointer-events-none" />

                <div className="max-w-md mx-auto z-10">
                    <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-2xl p-8 rounded-3xl border border-white/40 dark:border-slate-700/50 shadow-2xl shadow-indigo-500/5">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
                            Why use Private Mode?
                        </h3>

                        <div className="space-y-6">
                            <div className="flex gap-4">
                                <div className="mt-1 bg-indigo-100 dark:bg-indigo-500/20 p-2.5 rounded-xl h-fit">
                                    <Cloud className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">Offline Queuing</h4>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed text-pretty">
                                        Send links from your phone, and they'll be waiting on your laptop when you open it.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="mt-1 bg-emerald-100 dark:bg-emerald-500/20 p-2.5 rounded-xl h-fit">
                                    <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">End-to-End Isolated</h4>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed text-pretty">
                                        Powered by Supabase RLS. Your clipboard is completely invisible to anyone else on your network.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="mt-1 bg-violet-100 dark:bg-violet-500/20 p-2.5 rounded-xl h-fit">
                                    <Zap className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">Universal Access</h4>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed text-pretty">
                                        Access your unified board from any network, not just local Wi-Fi. It's like Apple Handoff, but everywhere.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 flex items-center justify-center gap-x-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                        Zero tracking. Open source. Forever free.
                    </div>
                </div>
            </div>
        </div>
    );
}
