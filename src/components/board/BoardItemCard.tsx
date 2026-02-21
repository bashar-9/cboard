'use client';

import { useState, useEffect } from 'react';
import { useBoardNetwork } from '@/hooks/useBoardNetwork';
import { deletePrivateItemFromDb } from '@/hooks/usePrivateNetwork';
import { useBoardStore, SharedItem } from '@/store/useBoardStore';
import { Button } from '@/components/ui/button';
import { Copy, Clock, Timer, Trash2, CheckCircle2, Download, File as FileIcon, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { ItemDetailModal } from './ItemDetailModal';

const TEXT_CLAMP_LENGTH = 280;

function ExpiresIn({ expiresAt }: { expiresAt: number }) {
    const [mins, setMins] = useState<number | null>(null);

    useEffect(() => {
        const updateTime = () => setMins(Math.max(0, Math.ceil((expiresAt - Date.now()) / 60000)));
        updateTime();
        const interval = setInterval(updateTime, 60000);
        return () => clearInterval(interval);
    }, [expiresAt]);

    if (mins === null || mins <= 0) return null;

    return (
        <span className="flex items-center gap-0.5 text-slate-400 dark:text-slate-500">
            <span>·</span>
            <Timer className="w-3 h-3" />
            <span>{mins}m</span>
        </span>
    );
}

interface BoardItemCardProps {
    item: SharedItem;
}

export function BoardItemCard({ item }: BoardItemCardProps) {
    const { deleteItem } = useBoardNetwork();
    const { myId } = useBoardStore();
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);

    const copyToClipboard = (id: string, text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        toast.success('Copied to clipboard');
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleDelete = (id: string, scope?: string) => {
        if (scope === 'private') {
            deletePrivateItemFromDb(id);
        } else {
            deleteItem(id);
        }
        toast.success('Item deleted');
    };

    const isMine = item.senderId === myId || item.scope === 'private';
    const needsTruncation = item.content && item.content.length > TEXT_CLAMP_LENGTH;
    const displayText = needsTruncation
        ? item.content.slice(0, TEXT_CLAMP_LENGTH).trimEnd() + '…'
        : item.content;

    const textContentClass = "text-[13.5px] text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed break-words";

    return (
        <>
            <motion.div
                layout
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
                className="group break-inside-avoid mb-4"
            >
                <div
                    className="relative rounded-xl border border-slate-200/60 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03] backdrop-blur-md hover:bg-white/80 dark:hover:bg-white/[0.05] transition-colors duration-200 cursor-pointer"
                    onClick={() => setShowModal(true)}
                >
                    {/* Hover action buttons — top-right corner */}
                    <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        {(item.type === 'text' || (item.type === 'post' && item.content)) && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className={`h-7 w-7 rounded-lg cursor-pointer transition-all duration-200 ${copiedId === item.id ? 'text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 opacity-100' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]'}`}
                                onClick={(e) => { e.stopPropagation(); copyToClipboard(item.id, item.content); }}
                                title="Copy"
                            >
                                {copiedId === item.id ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            </Button>
                        )}
                        {isMine && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg cursor-pointer transition-all duration-200"
                                onClick={(e) => { e.stopPropagation(); handleDelete(item.id, item.scope); }}
                                title="Delete"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                        )}
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center gap-1.5 px-3.5 pt-3 pb-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${isMine ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' : 'bg-slate-500/15 dark:bg-slate-500/20 text-slate-500 dark:text-slate-400'}`}>
                            {item.scope === 'private' ? <Lock className="w-2.5 h-2.5" /> : (isMine ? 'Y' : 'S')}
                        </div>
                        <span className="font-medium text-slate-600 dark:text-slate-400">{item.scope === 'private' ? 'Private' : (isMine ? 'You' : 'Someone')}</span>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <Clock className="w-3 h-3 shrink-0 text-slate-300 dark:text-slate-600" />
                        <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {item.expiresAt && <ExpiresIn expiresAt={item.expiresAt} />}
                    </div>

                    {/* Content */}
                    <div className="px-3.5 pb-3 pt-0.5">
                        {item.type === 'post' ? (
                            <div className="flex flex-col gap-2">
                                {item.content && (
                                    <p className={textContentClass}>{displayText}</p>
                                )}
                                {/* Show attachment count as a compact indicator */}
                                {item.attachments && item.attachments.length > 0 && (
                                    <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 mt-1">
                                        <FileIcon className="w-3.5 h-3.5" />
                                        <span>{item.attachments.length} file{item.attachments.length > 1 ? 's' : ''} attached</span>
                                    </div>
                                )}
                            </div>
                        ) : item.type === 'file' ? (
                            <div className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50/60 dark:bg-white/[0.03] border border-slate-200/50 dark:border-white/[0.06]">
                                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200/50 dark:border-indigo-500/20 flex items-center justify-center shrink-0 overflow-hidden">
                                    {item.mimeType?.startsWith('image/') && item.fileData ? (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img src={item.fileData} alt="preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <FileIcon className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                                    )}
                                </div>
                                <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{item.fileName}</span>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                        {item.fileSize ? (item.fileSize / 1024 / 1024).toFixed(2) + ' MB' : 'Unknown'}
                                    </span>
                                </div>
                                <Download className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                            </div>
                        ) : (
                            <p className={textContentClass}>{displayText}</p>
                        )}

                        {/* View more hint */}
                        {needsTruncation && (
                            <span className="text-xs font-medium text-indigo-500 dark:text-indigo-400 mt-1.5 inline-block">
                                View more
                            </span>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* Detail Modal */}
            {showModal && (
                <ItemDetailModal item={item} onClose={() => setShowModal(false)} />
            )}
        </>
    );
}
