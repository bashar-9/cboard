'use client';

import { useBoardStore } from '@/store/useBoardStore';
import { useBoardNetworkInit } from '@/hooks/useBoardNetwork';
import { Header } from '@/components/board/Header';
import { ShareInput } from '@/components/board/ShareInput';
import { IncomingFilesProgress } from '@/components/board/IncomingFilesProgress';
import { BoardItemCard } from '@/components/board/BoardItemCard';
import { Users, Sparkles } from 'lucide-react';
import { Toaster } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function Home() {
  const { items, myId, roomCode, debugLogs } = useBoardStore();

  useBoardNetworkInit();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 selection:bg-indigo-200 dark:selection:bg-indigo-900 transition-colors duration-300 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[500px] bg-gradient-to-b from-indigo-500/10 via-purple-500/5 to-transparent dark:from-indigo-500/15 dark:via-purple-500/5 dark:to-transparent blur-3xl pointer-events-none -z-10" />

      <Header />

      <main className="max-w-3xl mx-auto w-full p-6 space-y-10 pt-10">
        <ShareInput />

        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
            className="flex items-center justify-between pb-2 border-b border-slate-200/50 dark:border-slate-800/50 mb-6"
          >
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              LIVE BOARD
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                ROOM: {roomCode ? roomCode.substring(0, 8) : '...'}
              </span>
            </div>
          </motion.div>

          <IncomingFilesProgress />

          {items.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-24 bg-white/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50 border-dashed rounded-[2rem] transition-colors duration-200 backdrop-blur-sm shadow-sm"
            >
              <div className="w-16 h-16 bg-gradient-to-tr from-slate-100 to-white dark:from-slate-800 dark:to-slate-700 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-white dark:border-slate-700/50">
                <Users className="w-8 h-8 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-slate-800 dark:text-slate-200 font-semibold text-lg transition-colors duration-200">The board is empty</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 transition-colors duration-200 max-w-xs mx-auto leading-relaxed">
                Anything you share will instantly appear here for everyone on your network.
              </p>
            </motion.div>
          ) : (
            <div className="space-y-6">
              <AnimatePresence mode="popLayout">
                {items.map((item) => (
                  <BoardItemCard key={item.id} item={item} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>

      {/* Debug console */}
      {process.env.NODE_ENV === 'development' && (
        <div className="max-w-3xl mx-auto p-6 text-xs font-mono text-slate-500 overflow-x-auto">
          <h3 className="font-bold mb-2">Debug Console</h3>
          <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-xl max-h-64 overflow-y-auto transition-colors duration-200">
            ID: {myId || 'None'} | Room: {roomCode || 'None'}<br />
            {debugLogs?.map((log, i) => <div key={i}>{log}</div>)}
          </div>
        </div>
      )}

      <Toaster position="bottom-right" />
    </div>
  );
}
