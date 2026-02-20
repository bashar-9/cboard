'use client';

import { useBoardStore } from '@/store/useBoardStore';
import { useBoardNetworkInit } from '@/hooks/useBoardNetwork';
import { Header } from '@/components/board/Header';
import { ShareInput } from '@/components/board/ShareInput';
import { IncomingFilesProgress } from '@/components/board/IncomingFilesProgress';
import { BoardItemCard } from '@/components/board/BoardItemCard';
import { Users } from 'lucide-react';
import { Toaster } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function Home() {
  const { items, myId, roomCode, debugLogs } = useBoardStore();

  useBoardNetworkInit();

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 selection:bg-indigo-200 dark:selection:bg-indigo-900 transition-colors duration-300 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[500px] bg-gradient-to-b from-indigo-500/10 via-purple-500/5 to-transparent dark:from-indigo-500/15 dark:via-purple-500/5 dark:to-transparent blur-3xl pointer-events-none -z-10" />

      <Header />

      {/* Scrollable board area */}
      <main className="flex-1 overflow-y-auto pb-28">
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 pt-6">
          <IncomingFilesProgress />

          {items.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-32"
            >
              <div className="w-16 h-16 bg-gradient-to-tr from-slate-100 to-white dark:from-slate-800 dark:to-slate-700 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-white dark:border-slate-700/50">
                <Users className="w-8 h-8 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-slate-800 dark:text-slate-200 font-semibold text-lg">The board is empty</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 max-w-xs mx-auto leading-relaxed">
                Anything you share will instantly appear here for everyone on your network.
              </p>
            </motion.div>
          ) : (
            <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
              <AnimatePresence mode="popLayout">
                {items.map((item) => (
                  <BoardItemCard key={item.id} item={item} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>

      {/* Bottom-pinned input bar */}
      <ShareInput />

      {/* Debug console */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-16 right-4 z-50 w-80 text-xs font-mono text-slate-500 opacity-30 hover:opacity-100 transition-opacity">
          <details>
            <summary className="cursor-pointer font-bold mb-1">Debug</summary>
            <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-xl max-h-48 overflow-y-auto transition-colors duration-200 border border-slate-200 dark:border-slate-800">
              ID: {myId || 'None'} | Room: {roomCode || 'None'}<br />
              {debugLogs?.map((log, i) => <div key={i}>{log}</div>)}
            </div>
          </details>
        </div>
      )}

      <Toaster position="bottom-right" />
    </div>
  );
}
