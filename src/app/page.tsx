'use client';

import { useState } from 'react';
import { useBoardNetwork } from '@/hooks/useBoardNetwork';
import { useBoardStore } from '@/store/useBoardStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Copy, Users, WifiOff, Send, Clock } from 'lucide-react';
import { Toaster, toast } from 'sonner';

export default function Home() {
  const { shareText, error } = useBoardNetwork();
  const { connectionState, peers, items, myId, roomCode, debugLogs } = useBoardStore();
  const [inputText, setInputText] = useState('');

  const handleShare = () => {
    if (!inputText.trim()) return;
    shareText(inputText.trim());
    setInputText('');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-slate-200">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-lg">
            S
          </div>
          <h1 className="font-semibold tracking-tight text-lg">Board</h1>
        </div>

        <div className="flex items-center gap-3 text-sm font-medium">
          {connectionState === 'connected' ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full border border-green-200/50">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span>{peers.length} Connected</span>
            </div>
          ) : connectionState === 'connecting' ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full border border-amber-200/50">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
              Connecting...
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 rounded-full border border-red-200/50">
              <WifiOff className="w-3 h-3" />
              Offline
            </div>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto w-full p-6 space-y-8 pt-8">

        {/* Input Area */}
        <div className="space-y-4">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-slate-200 to-slate-100 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-500"></div>
            <div className="relative bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col focus-within:ring-2 focus-within:ring-slate-900 focus-within:border-transparent transition-all">
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste text or drop files here to share with the network..."
                className="w-full min-h-[140px] resize-none border-0 shadow-none focus-visible:ring-0 p-5 text-base placeholder:text-slate-400 bg-transparent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    handleShare();
                  }
                }}
              />
              <div className="bg-slate-50/50 border-t border-slate-100 p-3 flex justify-between items-center">
                <span className="text-xs text-slate-400 ml-2 font-medium">Cmd + Enter to send</span>
                <Button
                  onClick={handleShare}
                  disabled={!inputText.trim() || connectionState !== 'connected'}
                  className="rounded-xl px-6 bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </div>
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        {/* Board Feed */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2">
            <h2 className="text-sm font-semibold text-slate-400 tracking-wider uppercase">Local Board</h2>
            <span className="text-xs text-slate-400">Room: {roomCode ? roomCode.substring(0, 8) : '...'}</span>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-20 bg-white border border-slate-200 border-dashed rounded-3xl">
              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <Users className="w-6 h-6 text-slate-300" />
              </div>
              <h3 className="text-slate-600 font-medium">Board is empty</h3>
              <p className="text-slate-400 text-sm mt-1">Anything you share will appear here for everyone on your network.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <Card key={item.id} className="group overflow-hidden rounded-2xl border-slate-200 shadow-sm transition-all hover:shadow-md hover:border-slate-300 bg-white">
                  <CardContent className="p-0">
                    <div className="flex flex-col p-5">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium tracking-tight">
                          <span className={`${item.senderId === myId ? 'text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md' : ''}`}>
                            {item.senderId === myId ? 'You' : 'Someone'}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg" onClick={() => copyToClipboard(item.content)}>
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-slate-700 whitespace-pre-wrap leading-relaxed break-words">
                        {item.content}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Debug console */}
      {process.env.NODE_ENV === 'development' && (
        <div className="max-w-3xl mx-auto p-6 text-xs font-mono text-slate-500 overflow-x-auto">
          <h3 className="font-bold mb-2">Debug Console</h3>
          <div className="bg-slate-100 p-4 rounded-xl max-h-64 overflow-y-auto">
            ID: {myId || 'None'} | Room: {roomCode || 'None'}<br />
            {debugLogs?.map((log, i) => <div key={i}>{log}</div>)}
          </div>
        </div>
      )}

      <Toaster position="bottom-right" />
    </div>
  );
}
