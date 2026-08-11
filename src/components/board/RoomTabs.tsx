'use client';

import { Globe, Lock } from 'lucide-react';
import { setLocalRoomPrivacy } from '@/hooks/useBoardNetwork';
import { useBoardStore, type LocalRoomPrivacy } from '@/store/useBoardStore';

function StatusDot({ room }: { room: LocalRoomPrivacy }) {
    const session = useBoardStore((state) => state.roomSessions[room]);
    const color = session.connectionState === 'connected'
        ? 'bg-emerald-500'
        : session.connectionState === 'disconnected'
            ? 'bg-red-400'
            : 'bg-amber-400';
    return <span className={`h-1.5 w-1.5 rounded-full ${color}`} aria-hidden="true" />;
}

export function RoomTabs() {
    const activeRoom = useBoardStore((state) => state.localRoomPrivacy);

    return (
        <div className="z-40 border-b border-slate-200/60 bg-slate-50/90 px-3 py-2 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/90">
            <div className="mx-auto grid max-w-md grid-cols-2 gap-1 rounded-xl bg-slate-200/60 p-1 dark:bg-slate-800/70" role="tablist" aria-label="Choose a room">
                {(['public', 'private'] as const).map((room) => {
                    const active = activeRoom === room;
                    const Icon = room === 'public' ? Globe : Lock;
                    return (
                        <button
                            key={room}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => setLocalRoomPrivacy(room)}
                            className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-all ${active
                                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}
                        >
                            <Icon className="h-4 w-4" />
                            {room === 'public' ? 'Public' : 'Private'}
                            <StatusDot room={room} />
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
