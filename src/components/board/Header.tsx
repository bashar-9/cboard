'use client';

import { useBoardStore } from '@/store/useBoardStore';
import { ThemeToggle } from '@/components/theme-toggle';
import { WifiOff, HelpCircle, Lock, Globe, LogIn, LogOut, Cloud } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PublicHowItWorks } from '@/components/board/PublicHowItWorks';
import { PrivateHowItWorks } from '@/components/board/PrivateHowItWorks';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export function Header() {
    const { connectionState, peers, isPrivateMode, setIsPrivateMode, user, setUser } = useBoardStore();
    const router = useRouter();

    const handleSignOut = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        setUser(null);
        setIsPrivateMode(false);
    };

    return (
        <motion.header
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="sticky top-0 z-50 bg-white/70 dark:bg-slate-950/70 backdrop-blur-2xl border-b border-slate-200/50 dark:border-slate-800/50 px-6 py-4 flex items-center justify-between transition-colors duration-300 shadow-sm"
        >
            <div className="flex items-center gap-3">
                <Link href="/" className="flex items-center gap-3 cursor-pointer">
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 dark:from-white dark:to-slate-200 text-white dark:text-slate-900 flex items-center justify-center font-bold text-lg transition-all duration-300 shadow-lg border border-slate-700 dark:border-white/20">
                        C
                    </div>
                    <h1 className="font-bold tracking-tight text-xl bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">Board</h1>
                </Link>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 text-sm font-medium">
                <Dialog>
                    <DialogTrigger asChild>
                        <button
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-all duration-200 cursor-pointer"
                            title="How It Works"
                        >
                            <HelpCircle className="w-4 h-4" />
                            <span className="hidden sm:inline text-xs font-semibold">How It Works</span>
                        </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl max-h-[85vh] bg-white/90 dark:bg-slate-950/90 backdrop-blur-3xl border-slate-200/50 dark:border-slate-800/50 p-0 overflow-y-auto">
                        <DialogTitle className="sr-only">How it works</DialogTitle>
                        <div className="p-6 sm:p-8">
                            <Tabs defaultValue="public" className="w-full">
                                <TabsList className="w-full mb-6 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-full">
                                    <TabsTrigger value="public" className="flex-1 rounded-full text-xs font-semibold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm gap-1.5 cursor-pointer">
                                        <Globe className="w-3.5 h-3.5" />
                                        Public Mode
                                    </TabsTrigger>
                                    <TabsTrigger value="private" className="flex-1 rounded-full text-xs font-semibold data-[state=active]:bg-indigo-50 dark:data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-sm gap-1.5 cursor-pointer">
                                        <Lock className="w-3.5 h-3.5" />
                                        Private Mode
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="public">
                                    <PublicHowItWorks key="modal-public" className="py-0" />
                                </TabsContent>

                                <TabsContent value="private">
                                    <PrivateHowItWorks key="modal-private" className="py-0" />
                                    {/* Get Started with Private CTA */}
                                    {!user && (
                                        <div className="rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-blue-500/10 dark:from-indigo-500/15 dark:via-purple-500/15 dark:to-blue-500/15 border border-indigo-200/30 dark:border-indigo-500/20 p-5 sm:p-6 text-center mt-6">
                                            <h4 className="text-base font-bold text-slate-800 dark:text-white mb-1.5">Get started with Private Mode</h4>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Sign in to sync your clipboard across all your devices, anywhere in the world.</p>
                                            <Button
                                                className="rounded-full px-6 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/25 transition-all cursor-pointer"
                                                onClick={() => router.push('/auth')}
                                            >
                                                <LogIn className="w-4 h-4 mr-2" />
                                                Sign In to Get Started
                                            </Button>
                                        </div>
                                    )}
                                </TabsContent>
                            </Tabs>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Private/Public Toggle */}
                {user ? (
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800/50 p-1 rounded-full border border-slate-200/50 dark:border-slate-700/50">
                        <button
                            onClick={() => setIsPrivateMode(false)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer ${!isPrivateMode
                                ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-slate-200'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                        >
                            <Globe className="w-3 h-3" />
                            <span className="hidden sm:inline">Public</span>
                        </button>
                        <button
                            onClick={() => setIsPrivateMode(true)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer ${isPrivateMode
                                ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 shadow-sm'
                                : 'text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400'
                                }`}
                        >
                            <Lock className="w-3 h-3" />
                            <span className="hidden sm:inline">Private</span>
                        </button>
                    </div>
                ) : (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full text-xs font-semibold px-4 cursor-pointer text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                        onClick={() => router.push('/auth')}
                    >
                        <LogIn className="w-4 h-4 mr-1.5" />
                        Sign In
                    </Button>
                )}

                <ThemeToggle />

                {/* Logout Button */}
                {user && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleSignOut}
                        className="rounded-full h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        title="Sign Out"
                    >
                        <LogOut className="w-4 h-4" />
                    </Button>
                )}

                {/* Connection Status */}
                <AnimatePresence>
                    {isPrivateMode ? (
                        connectionState === 'connected' ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 rounded-full border border-indigo-200/50 dark:border-indigo-500/20 transition-colors duration-200">
                                <Cloud className="w-3 h-3" />
                                <span>Synced</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-full border border-amber-200/50 dark:border-amber-500/20 transition-colors duration-200">
                                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
                                Connecting...
                            </div>
                        )
                    ) : connectionState === 'connected' ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 rounded-full border border-green-200/50 dark:border-green-500/20 transition-colors duration-200">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            <span>{peers.length} Connected</span>
                        </div>
                    ) : connectionState === 'connecting' ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-full border border-amber-200/50 dark:border-amber-500/20 transition-colors duration-200">
                            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
                            Connecting...
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 rounded-full border border-red-200/50 dark:border-red-500/20 transition-colors duration-200">
                            <WifiOff className="w-3 h-3" />
                            Offline
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </motion.header>
    );
}
