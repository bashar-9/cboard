'use client';

import { Globe, Lock } from 'lucide-react';
import { useBoardStore } from '@/store/useBoardStore';

export function BoardEmptyState() {
    const { localRoomPrivacy, roomSessions } = useBoardStore();
    const session = roomSessions[localRoomPrivacy];
    const isPrivate = localRoomPrivacy === 'private';
    if (!session.roomId) return null;

    const connected = session.connectionState === 'connected';
    const Icon = isPrivate ? Lock : Globe;

    return (
        <div className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center px-4 pb-20 pt-8 text-center sm:pt-16">
            <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${isPrivate ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                <Icon className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold">{isPrivate ? 'Private room is ready' : 'Public room is ready'}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {connected
                    ? 'Type a message or drop a file below.'
                    : isPrivate ? 'Share the private link to connect another device.' : 'Open CBoard on another device using the same network.'}
            </p>
        </div>
    );
}
