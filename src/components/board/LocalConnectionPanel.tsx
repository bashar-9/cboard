'use client';

import { useState } from 'react';
import { Check, Copy, Globe, Link as LinkIcon, Loader2, Lock, LogOut, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { createPrivateRoom, leavePrivateRoom, setLocalRoomPrivacy } from '@/hooks/useBoardNetwork';
import { useBoardStore } from '@/store/useBoardStore';
import { Button } from '@/components/ui/button';

export function LocalConnectionPanel() {
    const { localRoomPrivacy, roomSessions, networkMode } = useBoardStore();
    const [copied, setCopied] = useState(false);
    const session = roomSessions[localRoomPrivacy];
    const isPrivate = localRoomPrivacy === 'private';
    const hasPrivateRoom = Boolean(roomSessions.private.shareUrl || roomSessions.private.myId);

    const copyLink = async () => {
        if (!session.shareUrl) return;
        try {
            await navigator.clipboard.writeText(session.shareUrl);
            setCopied(true);
            toast.success('Private link copied.');
            window.setTimeout(() => setCopied(false), 1500);
        } catch { toast.error('Copy is blocked. Select the link manually.'); }
    };

    const connected = session.connectionState === 'connected';
    const waiting = session.connectionState === 'connecting';

    return (
        <div className="max-w-xl mx-auto mb-6 rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 p-5 shadow-sm">
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/70 mb-5" role="tablist" aria-label="Board room">
                <button type="button" role="tab" aria-selected={!isPrivate} onClick={() => setLocalRoomPrivacy('public')}
                    className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${!isPrivate ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-700 dark:text-emerald-400' : 'text-slate-500'}`}>
                    <Globe className="w-4 h-4" /> Public
                    {roomSessions.public.connectionState === 'connected' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                </button>
                <button type="button" role="tab" aria-selected={isPrivate} onClick={() => setLocalRoomPrivacy('private')}
                    className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${isPrivate ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-700 dark:text-indigo-400' : 'text-slate-500'}`}>
                    <Lock className="w-4 h-4" /> Private
                    {roomSessions.private.connectionState === 'connected' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                </button>
            </div>

            {!isPrivate ? (
                <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Globe className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="font-bold text-lg">Public room</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {connected ? 'Connected to the other device.' : 'Open CBoard on another device using the same network.'}
                        </p>
                        {session.error && <p className="text-sm text-red-500 mt-2">{session.error}</p>}
                    </div>
                </div>
            ) : !hasPrivateRoom ? (
                <div className="text-center py-2">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mx-auto mb-3">
                        <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h2 className="font-bold text-lg">Create a Private room</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">Only someone with your private link can enter.</p>
                    <Button onClick={() => void createPrivateRoom()} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
                        <Plus className="w-4 h-4 mr-2" /> Create Private room
                    </Button>
                    {session.error && <p className="text-sm text-red-500 mt-3">{session.error}</p>}
                </div>
            ) : (
                <div>
                    <div className="flex items-start gap-4">
                        <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
                            {waiting ? <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" /> : <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="font-bold text-lg">Private room</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                {connected ? 'Connected. Your Public room is still open.' : session.role === 'host' ? 'Share this link with one person.' : 'Waiting for the other device.'}
                            </p>
                        </div>
                    </div>
                    {session.shareUrl && (
                        <div className="flex items-center gap-2 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 p-2 pl-4 mt-4">
                            <LinkIcon className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="text-sm font-mono truncate flex-1">{session.shareUrl}</span>
                            <Button variant="ghost" size="icon" onClick={copyLink} title="Copy private link">
                                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                            </Button>
                        </div>
                    )}
                    {session.error && <p className="text-sm text-red-500 mt-3">{session.error}</p>}
                    {networkMode === 'online' && (
                        <button type="button" onClick={leavePrivateRoom} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500 mt-4 mx-auto">
                            <LogOut className="w-3.5 h-3.5" /> Leave Private room
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
