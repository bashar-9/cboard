'use client';

import { useBoardStore } from '@/store/useBoardStore';
import { ThemeToggle } from '@/components/theme-toggle';
import { WifiOff } from 'lucide-react';
import { motion } from 'framer-motion';

export function Header() {
    const { connectionState, peers } = useBoardStore();

    return (
        <motion.header
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="sticky top-0 z-50 bg-white/70 dark:bg-slate-950/70 backdrop-blur-2xl border-b border-slate-200/50 dark:border-slate-800/50 px-6 py-4 flex items-center justify-between transition-colors duration-300 shadow-sm"
        >
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 dark:from-white dark:to-slate-200 text-white dark:text-slate-900 flex items-center justify-center font-bold text-lg transition-all duration-300 shadow-lg border border-slate-700 dark:border-white/20">
                    C
                </div>
                <h1 className="font-bold tracking-tight text-xl bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">Board</h1>
            </div>

            <div className="flex items-center gap-3 text-sm font-medium">
                <ThemeToggle />
                {connectionState === 'connected' ? (
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
            </div>
        </motion.header>
    );
}
