'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { CircleHelp, Cloud, Laptop, ShieldCheck, Smartphone, WifiOff } from 'lucide-react';
import { useBoardStore } from '@/store/useBoardStore';
import { ThemeToggle } from '@/components/theme-toggle';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PublicHowItWorks } from '@/components/board/PublicHowItWorks';

export function Header() {
    const { connectionState, networkMode, localRole, pairingState } = useBoardStore();
    const waiting = pairingState === 'hosting' || pairingState === 'needs-pin' || pairingState === 'joining' || pairingState === 'connecting';

    return (
        <motion.header
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="sticky top-0 z-50 bg-white/75 dark:bg-slate-950/75 backdrop-blur-2xl border-b border-slate-200/50 dark:border-slate-800/50 px-3 sm:px-6 py-3 flex items-center justify-between shadow-sm"
        >
            <Link href="/" className="flex items-center gap-2.5 cursor-pointer" aria-label="CBoard home">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 text-white dark:text-slate-900 flex items-center justify-center font-bold text-lg shadow-lg">
                    C
                </div>
                <div>
                    <h1 className="font-bold tracking-tight text-lg leading-none">Board</h1>
                    <span className="text-[10px] text-slate-400">Local sharing</span>
                </div>
            </Link>

            <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-medium">
                {networkMode && (
                    <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {networkMode === 'online'
                            ? <Cloud className="w-3.5 h-3.5" />
                            : localRole === 'host' ? <Laptop className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
                        {networkMode === 'online' ? 'Online public' : localRole === 'host' ? 'Host' : 'Receiver'}
                    </div>
                )}

                <Dialog>
                    <DialogTrigger asChild>
                        <button className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title="How CBoard works">
                            <CircleHelp className="w-4 h-4" />
                        </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto bg-white/95 dark:bg-slate-950/95 backdrop-blur-3xl">
                        <DialogTitle className="sr-only">How CBoard works</DialogTitle>
                        <PublicHowItWorks className="py-4" />
                    </DialogContent>
                </Dialog>

                <ThemeToggle />

                <AnimatePresence mode="wait">
                    {connectionState === 'connected' ? (
                        <motion.div key="connected" className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-full border border-emerald-200/60 dark:border-emerald-500/20">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Connected</span>
                        </motion.div>
                    ) : waiting ? (
                        <motion.div key="waiting" className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-full border border-amber-200/60 dark:border-amber-500/20">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            <span>Waiting</span>
                        </motion.div>
                    ) : (
                        <motion.div key="offline" className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 rounded-full border border-red-200/60 dark:border-red-500/20">
                            <WifiOff className="w-3.5 h-3.5" />
                            <span>Offline</span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.header>
    );
}
