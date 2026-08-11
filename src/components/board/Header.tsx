'use client';

import Link from 'next/link';
import { CircleHelp } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PublicHowItWorks } from '@/components/board/PublicHowItWorks';

export function Header() {
    return (
        <header className="z-50 flex items-center justify-between border-b border-slate-200/50 bg-white/80 px-3 py-3 shadow-sm backdrop-blur-2xl dark:border-slate-800/50 dark:bg-slate-950/80 sm:px-6">
            <Link href="/" className="flex items-center gap-2.5 cursor-pointer" aria-label="CBoard home">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 text-white dark:text-slate-900 flex items-center justify-center font-bold text-lg shadow-lg">
                    C
                </div>
                <div>
                    <h1 className="text-lg font-bold leading-none tracking-tight">CBoard</h1>
                    <span className="hidden text-[10px] text-slate-400 sm:block">Peer-to-peer sharing</span>
                </div>
            </Link>

            <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-medium">
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
            </div>
        </header>
    );
}
