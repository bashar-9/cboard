'use client';

import { useBoardStore } from '@/store/useBoardStore';
import { useBoardNetworkInit } from '@/hooks/useBoardNetwork';
import { usePrivateNetworkInit } from '@/hooks/usePrivateNetwork';
import { Header } from '@/components/board/Header';
import { ShareInput } from '@/components/board/ShareInput';
import { IncomingFilesProgress } from '@/components/board/IncomingFilesProgress';
import { BoardItemCard } from '@/components/board/BoardItemCard';
import { PublicHowItWorks } from '@/components/board/PublicHowItWorks';
import { PrivateHowItWorks } from '@/components/board/PrivateHowItWorks';
import { Toaster } from 'sonner';
import { AnimatePresence } from 'framer-motion';

export default function Home() {
  const { items, privateItems, myId, roomCode, debugLogs, isPrivateMode } = useBoardStore();

  useBoardNetworkInit();
  usePrivateNetworkInit();

  const displayedItems = isPrivateMode ? privateItems : items;

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 selection:bg-indigo-200 dark:selection:bg-indigo-900 transition-colors duration-300 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[500px] bg-gradient-to-b from-indigo-500/10 via-purple-500/5 to-transparent dark:from-indigo-500/15 dark:via-purple-500/5 dark:to-transparent blur-3xl pointer-events-none -z-10" />

      <Header />

      {/* Scrollable board area */}
      <main className="flex-1 overflow-y-auto pb-28">
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 h-full flex flex-col justify-center pt-2">
          <IncomingFilesProgress />

          {displayedItems.length === 0 ? (
            isPrivateMode ? <PrivateHowItWorks key="private-guide" /> : <PublicHowItWorks key="public-guide" />
          ) : (
            <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 pt-4">
              <AnimatePresence mode="popLayout">
                {displayedItems.map((item) => (
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
