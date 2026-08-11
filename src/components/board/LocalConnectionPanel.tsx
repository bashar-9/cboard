'use client';

import { useMemo, useState } from 'react';
import { Check, Copy, Globe, Link as LinkIcon, Loader2, Lock, LogOut, Plus, RefreshCw, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { createPrivateRoom, leavePrivateRoom } from '@/hooks/useBoardNetwork';
import { useBoardStore } from '@/store/useBoardStore';
import { Button } from '@/components/ui/button';

export function LocalConnectionPanel() {
    const { localRoomPrivacy, roomSessions, networkMode } = useBoardStore();
    const [copied, setCopied] = useState(false);
    const session = roomSessions[localRoomPrivacy];
    const isPrivate = localRoomPrivacy === 'private';
    const hasPrivateRoom = Boolean(roomSessions.private.roomId || roomSessions.private.shareUrl);
    const connected = session.connectionState === 'connected';
    const waiting = session.connectionState === 'connecting';
    const roomCode = useMemo(() => session.shareUrl?.split('/').filter(Boolean).at(-1), [session.shareUrl]);

    const copyLink = async () => {
        if (!session.shareUrl) return;
        try {
            await navigator.clipboard.writeText(session.shareUrl);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
        } catch { toast.error('Copy is blocked. Select the link manually.'); }
    };

    const shareLink = async () => {
        if (!session.shareUrl) return;
        if (navigator.share) {
            try {
                await navigator.share({ title: 'Join my CBoard room', text: 'Open this private CBoard room:', url: session.shareUrl });
                return;
            } catch (error) {
                if (error instanceof DOMException && error.name === 'AbortError') return;
            }
        }
        await copyLink();
    };

    if (!isPrivate) {
        return (
            <div className="mx-auto mb-5 flex max-w-3xl items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${connected ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                    {waiting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">Public · {connected ? 'Connected' : session.error ? 'Couldn’t connect' : 'Waiting'}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {connected ? 'Ready to share.' : 'Open CBoard on another device using the same network.'}
                    </p>
                </div>
                {session.error && (
                    <Button variant="ghost" size="sm" onClick={() => window.location.reload()} className="shrink-0 rounded-xl">
                        <RefreshCw className="mr-1.5 h-4 w-4" /> Retry
                    </Button>
                )}
            </div>
        );
    }

    if (!hasPrivateRoom) {
        return (
            <div className="mx-auto mb-5 max-w-lg rounded-3xl border border-indigo-200/60 bg-white/90 p-6 text-center shadow-sm dark:border-indigo-500/20 dark:bg-slate-900/80 sm:p-8">
                <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <Lock className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-bold">Create a Private room</h2>
                <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">Anyone with the private link can join.</p>
                <Button onClick={() => void createPrivateRoom()} className="mt-5 min-h-11 rounded-xl bg-indigo-600 px-5 text-white hover:bg-indigo-700">
                    <Plus className="mr-2 h-4 w-4" /> Create Private room
                </Button>
                {session.error && <p className="mt-3 text-sm text-red-500">{session.error}</p>}
            </div>
        );
    }

    return (
        <div className="mx-auto mb-5 max-w-3xl rounded-2xl border border-indigo-200/60 bg-white/90 p-4 shadow-sm dark:border-indigo-500/20 dark:bg-slate-900/80 sm:p-5">
            <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${connected ? 'bg-emerald-500/10 text-emerald-600' : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'}`}>
                    {waiting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">Private · {connected ? 'Connected' : session.error ? 'Couldn’t connect' : 'Waiting'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{connected ? 'Public is still connected in the background.' : session.role === 'host' ? 'Share the link to connect another device.' : 'Waiting for the other device.'}</p>
                </div>
                {networkMode === 'online' && (
                    <Button variant="ghost" size="icon" onClick={leavePrivateRoom} title="Leave Private room" className="shrink-0 rounded-xl text-slate-400 hover:text-red-500">
                        <LogOut className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {session.shareUrl && (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <div className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200/70 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-800/60">
                        <LinkIcon className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="min-w-0 flex-1 truncate font-mono text-sm">Room {roomCode}</span>
                        {copied && <span className="text-xs font-medium text-emerald-600">Copied</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex">
                        <Button variant="outline" onClick={copyLink} className="min-h-11 rounded-xl">
                            {copied ? <Check className="mr-2 h-4 w-4 text-emerald-500" /> : <Copy className="mr-2 h-4 w-4" />} Copy
                        </Button>
                        <Button onClick={shareLink} className="min-h-11 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">
                            <Share2 className="mr-2 h-4 w-4" /> Share
                        </Button>
                    </div>
                </div>
            )}
            {session.error && <p className="mt-3 text-sm text-red-500">{session.error}</p>}
        </div>
    );
}
