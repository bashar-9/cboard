'use client';

import { useState } from 'react';
import { Check, Copy, Globe, KeyRound, Laptop, Link as LinkIcon, Loader2, Lock, ShieldCheck, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { setLocalRoomPrivacy, submitPairingPin } from '@/hooks/useBoardNetwork';
import { useBoardStore } from '@/store/useBoardStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function LocalConnectionPanel() {
    const { networkMode, localRole, localRoomPrivacy, pairingCode, shareUrl, pairingState, pairingError } = useBoardStore();
    const [pin, setPin] = useState('');
    const [copied, setCopied] = useState(false);

    if (networkMode === 'online' || pairingState === 'paired') return null;

    const copyShareUrl = async () => {
        if (!shareUrl) return;
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            toast.success('Local address copied.');
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            toast.error('Copy is blocked. Select the address manually.');
        }
    };

    if (pairingState === 'connecting' || (localRole === 'receiver' && pairingState === 'joining')) {
        return (
            <div className="max-w-xl mx-auto mb-6 rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-6 text-center shadow-sm">
                <Loader2 className="w-6 h-6 mx-auto mb-3 animate-spin text-indigo-500" />
                <h2 className="font-semibold">Connecting securely…</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Keep this page open.</p>
            </div>
        );
    }

    if (localRole === 'host' && pairingState === 'hosting') {
        return (
            <div className="max-w-xl mx-auto mb-6 rounded-3xl border border-indigo-200/70 dark:border-indigo-500/20 bg-white/90 dark:bg-slate-900/80 p-6 shadow-lg shadow-indigo-500/5">
                <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
                        <Laptop className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 className="font-bold text-lg">This device is the Host</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {localRoomPrivacy === 'private'
                                ? 'The Receiver opens this address and enters your PIN.'
                                : 'Anyone on this network can open this address and connect.'}
                        </p>
                    </div>
                </div>

                <div className="mt-5 space-y-3">
                    <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/70">
                        <button
                            type="button"
                            onClick={() => setLocalRoomPrivacy('public')}
                            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${localRoomPrivacy === 'public' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-700 dark:text-emerald-400' : 'text-slate-500'}`}
                        >
                            <Globe className="w-4 h-4" /> Public
                        </button>
                        <button
                            type="button"
                            onClick={() => setLocalRoomPrivacy('private')}
                            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${localRoomPrivacy === 'private' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-700 dark:text-indigo-400' : 'text-slate-500'}`}
                        >
                            <Lock className="w-4 h-4" /> Private
                        </button>
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 p-2 pl-4">
                        <LinkIcon className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="text-sm font-mono truncate flex-1">{shareUrl || 'Finding local address…'}</span>
                        <Button variant="ghost" size="icon" onClick={copyShareUrl} disabled={!shareUrl} title="Copy local address">
                            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </Button>
                    </div>
                    {localRoomPrivacy === 'private' && (
                        <div className="flex items-center justify-between rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200/60 dark:border-indigo-500/20 px-4 py-3">
                            <span className="flex items-center gap-2 text-sm font-medium text-indigo-700 dark:text-indigo-300"><KeyRound className="w-4 h-4" /> Pairing PIN</span>
                            <span className="font-mono text-xl font-bold tracking-[0.25em] text-indigo-700 dark:text-indigo-300">{pairingCode || '------'}</span>
                        </div>
                    )}
                </div>
                <p className="text-xs text-slate-400 mt-4 text-center">
                    Waiting for one Receiver. {localRoomPrivacy === 'private' ? 'The PIN stays on this local server only.' : 'No PIN is required.'}
                </p>
            </div>
        );
    }

    if (localRole === 'receiver' && pairingState === 'needs-pin') {
        return (
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    submitPairingPin(pin);
                }}
                className="max-w-md mx-auto mb-6 rounded-3xl border border-indigo-200/70 dark:border-indigo-500/20 bg-white/90 dark:bg-slate-900/80 p-6 text-center shadow-lg shadow-indigo-500/5"
            >
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
                    <Smartphone className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h2 className="font-bold text-xl">Join the Host</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-5">Enter the six-digit PIN shown on the Host device.</p>
                <Input
                    value={pin}
                    onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    aria-label="Pairing PIN"
                    className="h-14 text-center font-mono text-2xl tracking-[0.3em] rounded-2xl"
                    autoFocus
                />
                {pairingError && <p className="text-sm text-red-500 mt-3" role="alert">{pairingError}</p>}
                <Button type="submit" disabled={pin.length !== 6} className="w-full h-11 rounded-xl mt-4 bg-indigo-600 hover:bg-indigo-700 text-white">
                    <ShieldCheck className="w-4 h-4 mr-2" /> Connect securely
                </Button>
            </form>
        );
    }

    return (
        <div className="max-w-md mx-auto mb-6 rounded-3xl border border-red-200 dark:border-red-500/20 bg-red-50/80 dark:bg-red-500/10 p-6 text-center">
            <ShieldCheck className="w-6 h-6 mx-auto mb-3 text-red-500" />
            <h2 className="font-semibold">Connection unavailable</h2>
            <p className="text-sm text-red-600/80 dark:text-red-300 mt-1">{pairingError || 'Refresh the page to try again.'}</p>
        </div>
    );
}
